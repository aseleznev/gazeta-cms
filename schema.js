const { File, Text, Relationship, Select, CalendarDay, Checkbox, Password } = require('@keystonejs/fields');
const { LocalFileAdapter } = require('@keystonejs/file-adapters');
const { atTracking, byTracking } = require('@keystonejs/list-plugins');
const { Wysiwyg } = require('@keystonejs/fields-wysiwyg-tinymce');

const { staticRoute, staticPath, backendUrl, tinyMceBaseUrl, host, apiKey } = require('./config');

const { getReleaseQuery, mapContent, publishRelease } = require('./helper.js');
const fetch = require('node-fetch');

const HttpsProxyAgent = require('https-proxy-agent');
//const agent = new HttpsProxyAgent({ host: 'localhost', port: 4000 });
const agent = null;

const fileAdapter = new LocalFileAdapter({
    src: `${staticPath}`,
    path: `${staticRoute}`,
    getFilename: ({ id, originalFilename }) => `mceu_${id}.${originalFilename.split('.').pop()}`
});

const isAdmin = ({ authentication: { item: user } }) => !!user && !!user.isAdmin;

const validateInput = async ({ existingItem, originalInput, actions }) => {
    if (originalInput.state === 'published') {
        const { errors, data } = await actions.query(getReleaseQuery(existingItem.id));

        if (errors) {
            console.warn(errors, `Не удалось выполнить GraphQl запрос`);
            throw 'Не удалось выполнить GraphQl запрос';
        }

        const { release } = data;

        try {
            const releaseData = await mapContent(release);
            await publishRelease(releaseData);
        } catch (err) {
            console.warn(err);
            throw err;
        }

        // const publishResults = await publishRelease(releaseData);
        // let message = '';
        // publishResults.forEach(result => {
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

const options = [
    { value: 'draft', label: 'Проект' },
    { value: 'published', label: 'Опубликован' },
    { value: 'archive', label: 'Архив' }
];

exports.Release = {
    // label: 'Выпуск',
    // plural: 'Выпуски',
    // singular: 'Выпуск',
    // itemQueryName: 'Release',
    // listQueryName: 'ReleaseList',
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
        afterDelete: async ({ existingItem }) => {
            if (existingItem.image) {
                await fileAdapter.delete(existingItem.image);
            }
            if (existingItem.id) {
                const hashedApiKey = await bcrypt.hash(apiKey, 10);
                fetch(`${backendUrl}/release/${existingItem.id}`, {
                    agent,
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json', apiKey: hashedApiKey }
                })
                    .then(res => console.warn(res))
                    .catch(err => console.warn(err));
            }
        }
    },
    plugins: [atTracking({ format: 'YYYY-MM-DD' }), byTracking({ ref: 'People' })],
    adminConfig: {
        defaultPageSize: 20,
        defaultColumns: 'id, date, title, state',
        defaultSort: 'id'
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
        release: { type: Relationship, ref: 'Release.articles', many: false, label: 'Выпуск' },
        tags: { type: Relationship, ref: 'Tag.articles', many: true, label: 'Рубрики' },
        author: {
            type: Relationship,
            ref: 'People',
            access: {
                create: isAdmin
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
        afterDelete: async ({ existingItem }) => {
            if (existingItem.image) {
                await fileAdapter.delete(existingItem.image);
            }
            if (existingItem.id) {
                const hashedApiKey = await bcrypt.hash(apiKey, 10);
                fetch(`${backendUrl}/article/${existingItem.id}`, {
                    agent,
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json', apiKey: hashedApiKey }
                })
                    .then(res => console.warn(res))
                    .catch(err => console.warn(err));
            }
        }
    },
    adminConfig: {
        defaultPageSize: 20,
        defaultColumns: 'id, release, order, title',
        defaultSort: 'release, order'
    },
    labelResolver: item => item.title
};

exports.Tag = {
    // label: 'Рубрика',
    // plural: 'Рубрики',
    // singular: 'Рубрика',
    // itemQueryName: 'Tag',
    // listQueryName: 'TagList',
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
        afterDelete: async ({ existingItem }) => {
            if (existingItem.id) {
                const hashedApiKey = await bcrypt.hash(apiKey, 10);
                fetch(`${backendUrl}/tag/${existingItem.id}`, {
                    agent,
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json', apiKey: hashedApiKey }
                })
                    .then(res => console.warn(res))
                    .catch(err => console.warn(err));
            }
        }
    },

    plugins: [atTracking({ format: 'YYYY-MM-DD' }), byTracking({ ref: 'People' })],
    adminConfig: {
        defaultPageSize: 20,
        defaultColumns: 'id, title, description',
        defaultSort: 'title'
    },
    labelResolver: item => item.title
};

const userIsAdmin = ({ authentication: { item: user } }) => Boolean(user && user.isAdmin);

exports.People = {
    plural: 'Peoples',
    singular: 'People',
    fields: {
        name: { type: Text },
        email: {
            type: Text,
            isUnique: true
        },
        isAdmin: {
            type: Checkbox,
            access: {
                update: userIsAdmin
            }
        },
        password: {
            type: Password
        }
    },
    access: {
        read: true,
        update: userIsAdmin,
        create: userIsAdmin,
        delete: userIsAdmin,
        auth: true
    }
};
