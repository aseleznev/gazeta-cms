const dev = process.env.NODE_ENV === 'development';

const HttpsProxyAgent = require('https-proxy-agent');
const { join } = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { createReadStream } = require('fs');
const FormData = require('form-data');
const parser = require('posthtml-parser');
const decode = require('html-entities-decoder');

const { File, Text, Relationship, Select, CalendarDay } = require('@keystonejs/fields');
const { LocalFileAdapter } = require('@keystonejs/file-adapters');
const { atTracking, byTracking } = require('@keystonejs/list-plugins');
const { Wysiwyg } = require('@keystonejs/fields-wysiwyg-tinymce');

const { staticRoute, staticPath, backendUrl, tinyMceBaseUrl, host, apiKey } = require('./config');

//let agent = new HttpsProxyAgent({ host: 'localhost', port: 4000 });
//
// if (!dev) {
//     agent = null;
// }
const agent = null;

const bcrypt = require('bcrypt');

const fileAdapter = new LocalFileAdapter({
    src: `${staticPath}`,
    path: `${staticRoute}`,
    getFilename: ({ id, originalFilename }) => `mceu_${id}.${originalFilename.split('.').pop()}`
});

const options = [
    { value: 'draft', label: 'Проект' },
    { value: 'published', label: 'Опубликован' },
    { value: 'archive', label: 'Архив' }
];

const isAdmin = ({ authentication: { item: user } }) => !!user && !!user.isAdmin;

const validateInput = async ({ existingItem, originalInput, actions }) => {
    if (originalInput.state === 'published') {
        const { errors, data } = await actions.query(
            `
        query{
              release: Release(where: {id:"${existingItem.id}"}){
                id
                title
                date
                description
                image{
                    id
                    filename
                }
                articles(orderBy: "order"){
                  id
                  date
                  title
                  description
                  order
                  content
                  writer
                  image{
                    id
                    filename
                  }
                  author{
                    id
                    name
                  }
                  tags{
                    id
                    title
                    description
                  }
                }
              }
            }
        `
        );

        if (errors) {
            console.warn(errors, `Не удалось выполнить GraphQl запрос`);
            throw 'Не удалось выполнить GraphQl запрос';
        }

        const { release } = data;

        const releaseData = await mapContent(release);
        if (releaseData === 'false') {
            throw 'Не удалось получить содержание статьи!';
        }

        // console.warn('---releaseData---');
        // console.warn(releaseData);

        publishRelease(releaseData)
            .then(() => console.warn('all ok'))
            .catch(err => console.warn(err.message));

        // const publishResults = await publishRelease(releaseData);
        // let message = '';
        // publishResults.forEach(result => {
        //     console.warn('---publishResult---');
        //     console.warn(result.status);
        //     if (result.status === 'rejected') {
        //         message += `${result.reason.message}\n`;
        //     }
        // });
        // if (message !== '') {
        //     throw `Не удалось отправить данные выпуска по причине: ${message}`;
        // }
    }
};

function addServiceFields(release) {}

function getFilenameFromSrc(src) {
    return src.replace(`${host}${staticRoute}/`, '');
}

async function mapContent(release) {
    return new Promise((resolve, reject) => {
        if (!release) {
            reject('false');
        }
        if (release.image) {
            release.image.originalFilename = release.image.filename;
            release.image.filename = 'conv_' + release.image.filename;
        }
        release.articles.forEach(article => {
            if (article.image) {
                article.image.originalFilename = article.image.filename;
                article.image.filename = 'conv_' + article.image.filename;
            }
            const pd = parser(article.content);
            const articleContent = [];
            let order = 1;
            pd.forEach(node => {
                if (node.tag === 'p') {
                    node.content.forEach(nodeContent => {
                        if (nodeContent.hasOwnProperty('tag')) {
                            if (nodeContent.tag === 'img') {
                                const originalFilename = getFilenameFromSrc(nodeContent.attrs.src);
                                articleContent.push({
                                    type: 'image',
                                    order,
                                    id: article.id + order.toString(),
                                    image: {
                                        id: article.id + order.toString() + 'i',
                                        alt: nodeContent.attrs.alt,
                                        originalFilename,
                                        filename: 'conv_' + originalFilename
                                    }
                                });
                                order++;
                            } else if (nodeContent.tag === 'strong' || nodeContent.tag === 'em') {
                                articleContent.push({
                                    type: nodeContent.tag === 'strong' ? 'paragraph-strong' : 'paragraph-italic',
                                    order,
                                    id: article.id + order.toString(),
                                    text: decode(nodeContent.content[0])
                                });
                                order++;
                            }
                        } else {
                            articleContent.push({
                                type: 'paragraph',
                                order,
                                text: decode(nodeContent),
                                id: article.id + order.toString()
                            });
                            order++;
                        }
                    });
                } else if (node.tag === 'blockquote') {
                    node.content.forEach(nodeContent => {
                        if (nodeContent.tag === 'p') {
                            nodeContent.content.forEach(content => {
                                if (content.tag === 'img') {
                                    const originalFilename = getFilenameFromSrc(content.attrs.src);
                                    articleContent.push({
                                        type: 'image',
                                        order,
                                        id: article.id + order.toString(),
                                        image: {
                                            id: article.id + order.toString() + 'i',
                                            alt: content.attrs.alt,
                                            originalFilename,
                                            filename: 'conv_' + originalFilename
                                        }
                                    });
                                    order++;
                                } else {
                                    articleContent.push({
                                        type: 'blockquote',
                                        order,
                                        text: decode(content),
                                        id: article.id + order.toString()
                                    });
                                    order++;
                                }
                            });
                        }
                    });
                }
            });
            article.content = articleContent;
        });

        resolve(release);
    });
}

async function getResizedImage(originalFilename, filename) {
    return new Promise((resolve, reject) => {
        const qt = require('quickthumb');
        const file = join(__dirname, '..', 'gazeta-upload', originalFilename);
        const convFile = join(__dirname, '..', 'gazeta-upload', filename);
        //поищем уже сконвертированный файл
        fs.access(convFile, fs.constants.F_OK, err => {
            if (err) {
                qt.convert({ src: file, dst: convFile, width: 1000 }, (err, path) => {
                    if (err) {
                        console.warn(err);
                        reject(err);
                    }
                    resolve(path);
                });
            } else {
                resolve(convFile);
            }
        });
    });
}

async function publishRelease(release) {
    return new Promise(async (resolve, reject) => {
        const promises = [];
        const hashedApiKey = await bcrypt.hash(apiKey, 10);

        if (release.image) {
            const formData = new FormData();
            try {
                const file = await getResizedImage(release.image.originalFilename, release.image.filename);
                const readStream = createReadStream(file);
                formData.append('file', readStream);
                promises.push(
                    fetch(`${backendUrl}/image`, {
                        agent,
                        method: 'POST',
                        body: formData,
                        headers: { apiKey: hashedApiKey }
                    })
                );
            } catch (err) {
                console.warn(err);
            }
        }

        promises.push(
            fetch(`${backendUrl}/release`, {
                agent,
                method: 'POST',
                body: JSON.stringify(release),
                headers: { 'Content-Type': 'application/json', apiKey: hashedApiKey }
            })
        );

        for (const article of release.articles) {
            if (article.image) {
                const formData = new FormData();
                const file = await getResizedImage(article.image.originalFilename, article.image.filename);
                const readStream = createReadStream(file);
                formData.append('file', readStream);
                promises.push(
                    fetch(`${backendUrl}/image`, {
                        agent,
                        method: 'POST',
                        body: formData,
                        headers: { apiKey: hashedApiKey }
                    })
                );
            }
            for (const content of article.content) {
                if (content.type === 'image') {
                    const formData = new FormData();
                    const file = await getResizedImage(content.image.originalFilename, content.image.filename);
                    const readStream = createReadStream(file);
                    formData.append('file', readStream);
                    promises.push(
                        fetch(`${backendUrl}/image`, {
                            agent,
                            method: 'POST',
                            body: formData,
                            headers: { apiKey: hashedApiKey }
                        })
                    );
                }
            }
        }

        //Promise.allSettled(contentPromises).then(results => results.forEach(result => console.warn(result.status)));
        resolve(Promise.all(promises).then(results => results));
    });
}

exports.Release = {
    // label: 'Выпуск',
    // plural: 'Выпуски',
    // singular: 'Выпуск',
    // itemQueryName: 'Release',
    // listQueryName: 'Releases',
    fields: {
        date: {
            type: CalendarDay,
            //format: { locale: 'ru' },
            yearRangeFrom: 2020,
            yearRangeTo: 2030,
            yearPickerType: 'auto',
            defaultValue: new Date().toISOString().substring(0, 10),
            label: 'Дата'
        },
        title: { type: String, isRequired: true, isUnique: true, label: 'Заголовок' },
        description: {
            type: Text,
            isRequired: true,
            isMultiline: true,
            label: 'Описание'
        },
        state: {
            type: Select,
            options,
            dataType: 'string',
            defaultValue: 'draft',
            label: 'Состояние',
            hooks: {
                validateInput
            }
        },
        image: {
            type: File,
            adapter: fileAdapter,
            hooks: {
                beforeChange: async ({ existingItem }) => {
                    if (existingItem && existingItem.file) {
                        await fileAdapter.delete(existingItem.file);
                    }
                }
            },
            label: 'Изображение для анонса'
        },
        articles: {
            type: Relationship,
            ref: 'Article.release',
            isRequired: false,
            many: true,
            label: 'Статьи'
        }
    },
    hooks: {
        afterDelete: ({ existingItem }) => {
            if (existingItem.image) {
                fileAdapter.delete(existingItem.image);
            }
            if (existingItem.id) {
                fetch(`${backendUrl}/release/${existingItem.id}`, {
                    agent,
                    method: 'DELETE'
                })
                    .then(res => console.warn(res))
                    .catch(err => console.warn(err));
            }
        }
    },
    plugins: [atTracking({ format: 'YYYY-MM-DD' }), byTracking({ ref: 'People' })],
    adminConfig: {
        defaultPageSize: 20,
        defaultColumns: 'date, title, state',
        defaultSort: 'date'
    },
    labelResolver: item => item.title
};

exports.Article = {
    // label: 'Статья',
    // plural: 'Articles',
    // singular: 'Article',
    // itemQueryName: 'Article',
    // listQueryName: 'ArticleList',
    fields: {
        date: {
            type: CalendarDay,
            //format: 'DD/MM/YYYY',
            //inputFormat: 'DD/MM/YYYY',
            yearRangeFrom: 2020,
            yearRangeTo: 2030,
            yearPickerType: 'auto',
            defaultValue: new Date().toISOString().substring(0, 10),
            label: 'Дата'
        },
        title: { type: String, isRequired: true, isUnique: true, label: 'Заголовок' },
        description: {
            type: Text,
            isRequired: true,
            isMultiline: true,
            label: 'Описание'
        },
        image: {
            type: File,
            adapter: fileAdapter,
            hooks: {
                beforeChange: async ({ existingItem }) => {
                    if (existingItem && existingItem.file) {
                        await fileAdapter.delete(existingItem.file);
                    }
                }
            },
            label: 'Изображение для анонса'
        },
        order: { type: Number, isRequired: true, defaultValue: 1, label: 'Порядок' },
        release: { type: Relationship, ref: 'Release.articles', many: false, label: 'Релиз' },
        tags: { type: Relationship, ref: 'Tag.articles', many: true, label: 'Рубрики' },
        author: {
            type: Relationship,
            ref: 'People',
            access: {
                create: isAdmin
                // update: isAdmin
            },
            label: 'Пользователь'
        },
        content: {
            label: 'Содержимое',
            type: Wysiwyg,
            editorConfig: {
                plugins: 'autoresize paste quickbars hr image',
                block_formats: 'Блок внимания=blockquote',
                toolbar: 'formatselect | bold italic | quickimage image | selectall | undo redo | preview',
                quickbars_selection_toolbar: 'bold italic | blockquote | removeformat | image',
                statusbar: true,
                elementpath: true,
                height: 300,
                menubar: false,
                placeholder: 'Напишите что-нибудь интересное...',
                images_upload_url: `${host}/admin/image-upload`,
                automatic_uploads: true,
                convert_urls: false,
                base_url: tinyMceBaseUrl
            }
        },
        writer: { type: String, isRequired: false, isUnique: false, label: 'Автор' }
    },
    plugins: [atTracking({ format: 'YYYY-MM-DD' }), byTracking({ ref: 'People' })],
    hooks: {
        afterDelete: ({ existingItem }) => {
            if (existingItem.image) {
                fileAdapter.delete(existingItem.image);
            }
            if (existingItem.id) {
                fetch(`${backendUrl}/article/${existingItem.id}`, {
                    agent,
                    method: 'DELETE'
                })
                    .then(res => console.warn(res))
                    .catch(err => console.warn(err));
            }
        }
    },
    adminConfig: {
        defaultPageSize: 20,
        defaultColumns: 'release, order, title',
        defaultSort: 'release, order'
    },
    labelResolver: item => item.title
};

exports.Tag = {
    // label: 'Выпуск',
    // plural: 'Выпуски',
    // singular: 'Выпуск',
    // itemQueryName: 'Release',
    // listQueryName: 'Releases',
    fields: {
        title: { type: String, isRequired: true, isUnique: true, label: 'Название' },
        description: {
            type: Text,
            isRequired: false,
            isMultiline: true,
            label: 'Описание'
        },
        articles: {
            type: Relationship,
            ref: 'Article.tags',
            isRequired: false,
            many: true,
            label: 'Статьи'
        }
    },
    hooks: {
        afterDelete: ({ existingItem }) => {
            if (existingItem.id) {
                fetch(`${backendUrl}/tag/${existingItem.id}`, {
                    agent,
                    method: 'DELETE'
                })
                    .then(res => console.warn(res))
                    .catch(err => console.warn(err));
            }
        }
    },

    plugins: [atTracking({ format: 'YYYY-MM-DD' }), byTracking({ ref: 'People' })],
    adminConfig: {
        defaultPageSize: 20,
        defaultColumns: 'title, description',
        defaultSort: 'title'
    },
    labelResolver: item => item.title
};
