const { host, staticRoute, backendUrl, apiKey } = require('./config');

const fs = require('fs');
const { join } = require('path');
const FormData = require('form-data');
const parser = require('posthtml-parser');
const decode = require('html-entities-decoder');
const bcrypt = require('bcrypt');
const qt = require('quickthumb');

const HttpsProxyAgent = require('https-proxy-agent');
//const agent = new HttpsProxyAgent({ host: 'localhost', port: 4000 });
const agent = null;

const getFilenameFromSrc = src => {
    return src.replace(`${host}${staticRoute}/`, '');
};

const getImage = async (originalFilename, filename) => {
    return new Promise(resolve => {
        const file = join(__dirname, '..', 'gazeta-upload', originalFilename);
        const convertedFile = join(__dirname, '..', 'gazeta-upload', filename);
        //поищем уже сконвертированный файл
        fs.access(convertedFile, fs.constants.F_OK, err => {
            if (err) {
                qt.convert({ src: file, dst: convertedFile, width: 1000 }, (err, path) => {
                    if (err) {
                        console.warn(err);
                        throw err;
                    }
                    resolve(path);
                });
            } else {
                resolve(convertedFile);
            }
        });
    });
};

const pushImagePost = async (promises, originalFilename, filename) => {
    try {
        const hashedApiKey = await bcrypt.hash(apiKey, 10);
        const formData = new FormData();
        const file = await getImage(originalFilename, filename);
        const readStream = fs.createReadStream(file);
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
        throw err;
    }
};

module.exports = {
    getReleaseQuery: itemId => {
        const query = `query{
                          release: Release(where: {id:"${itemId}"}){
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
                    `;
        return query;
    },
    publishRelease: async release => {
        return new Promise(async resolve => {
            const promises = [];
            const hashedApiKey = await bcrypt.hash(apiKey, 10);

            promises.push(
                fetch(`${backendUrl}/release`, {
                    agent,
                    method: 'POST',
                    body: JSON.stringify(release),
                    headers: { 'Content-Type': 'application/json', apiKey: hashedApiKey }
                })
            );

            if (release.image) {
                await pushImagePost(promises, release.image.originalFilename, release.image.filename);
            }

            for (const article of release.articles) {
                if (article.image) {
                    await pushImagePost(promises, article.image.originalFilename, article.image.filename);
                }
                for (const content of article.content) {
                    if (content.type === 'image') {
                        await pushImagePost(promises, content.image.originalFilename, content.image.filename);
                    }
                }
            }

            //Promise.allSettled(contentPromises).then(results => results.forEach(result => console.warn(result.status)));
            resolve(Promise.all(promises).then(results => results));
        });
    },
    mapContent: async release => {
        return new Promise(resolve => {
            if (!release) {
                throw 'Не удалось получить данные выпуска';
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
                const parsedData = parser(article.content);
                const articleContent = [];
                let order = 1;
                parsedData.forEach(node => {
                    if (node.hasOwnProperty('tag')) {
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
                                        try {
                                            decode(nodeContent.content[0]);
                                        } catch (e) {
                                            throw `Ошибка при разборе содержимого статьи с ид ${article.id}`;
                                        }
                                        articleContent.push({
                                            type:
                                                nodeContent.tag === 'strong' ? 'paragraph-strong' : 'paragraph-italic',
                                            order,
                                            id: article.id + order.toString(),
                                            text: decode(nodeContent.content[0])
                                        });
                                        order++;
                                    }
                                } else {
                                    try {
                                        decode(nodeContent);
                                    } catch (e) {
                                        throw `Ошибка при разборе содержимого статьи с ид ${article.id}`;
                                    }
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
                                if (nodeContent.hasOwnProperty('tag')) {
                                    if (nodeContent.tag === 'p') {
                                        nodeContent.content.forEach(content => {
                                            if (content.hasOwnProperty('tag')) {
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
                                                } else if (content.tag === 'br') {
                                                } else {
                                                    try {
                                                        decode(content);
                                                    } catch (e) {
                                                        throw `Ошибка при разборе содержимого статьи с ид ${article.id}`;
                                                    }
                                                    articleContent.push({
                                                        type: 'blockquote',
                                                        order,
                                                        text: decode(content),
                                                        id: article.id + order.toString()
                                                    });
                                                    order++;
                                                }
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    }
                });
                article.content = articleContent;
            });
            resolve(release);
        });
    }
};
