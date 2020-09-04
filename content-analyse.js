const parser = require('posthtml-parser');
const decode = require('html-entities-decoder');

const { host, staticRoute } = require('./config');

const formatImage = obj => {
    if (obj.image) {
        obj.image.originalFilename = obj.image.filename;
        return obj.image;
    }
    return null;
};

const formatDate = date => {
    if (date) {
        const dateTemplate = date.split('-');
        return `${dateTemplate[2]}.${dateTemplate[1]}.${dateTemplate[0]}`;
    }
    return null;
};

const getFilenameFromSrc = src => {
    return src.replace(`${host}${staticRoute}/`, '');
};

const pushImage = (articleContent, content, order, articleId) => {
    try {
        const originalFilename = getFilenameFromSrc(content.attrs.src);
        let alt = content.attrs.alt;
        if (alt) {
            alt = decode(content.attrs.alt);
        }
        articleContent.push({
            type: 'image',
            order,
            id: articleId + order.toString(),
            image: {
                id: articleId + order.toString() + 'i',
                alt,
                originalFilename,
                filename: originalFilename
            }
        });
    } catch (e) {
        throw `Ошибка при разборе содержимого статьи с ид ${articleId}. ${e.message}`;
    }
};

const pushText = (articleContent, content, tag, order, articleId) => {
    try {
        let type = '';
        if (tag === 'strong') {
            type = 'paragraph-strong';
        } else if (tag === 'em') {
            type = 'paragraph-italic';
        } else if (tag === 'p') {
            type = 'paragraph';
        } else if (tag === 'blockquote') {
            type = 'blockquote';
        } else {
            throw `Ошибка при разборе содержимого статьи с ид ${articleId}. Неожиданный тип содержимого.`;
        }
        const text = decode(content);
        articleContent.push({
            type,
            order,
            text,
            id: articleId + order.toString()
        });
    } catch (e) {
        throw `Ошибка при разборе содержимого статьи с ид ${articleId}. ${e.message}`;
    }
};

module.exports = {
    mapContent: async release => {
        return new Promise(resolve => {
            if (!release) {
                throw 'Не удалось получить данные выпуска';
            }
            release.image = formatImage(release);
            release.date = formatDate(release.date);

            if (!release.articles.length) {
                throw 'К выпуску должны быть привязаны статьи';
            }

            release.articles.forEach(article => {
                article.image = formatImage(article);
                article.date = formatDate(article.date);

                const parsedData = parser(article.content);
                if (!parsedData.length) {
                    throw `Пустое содержимое статьи с ид ${article.id}`;
                }

                const articleContent = [];
                let order = 1;

                parsedData.forEach(node => {
                    if (node.hasOwnProperty('tag')) {
                        if (node.tag === 'p') {
                            node.content.forEach(nodeContent => {
                                if (nodeContent.hasOwnProperty('tag')) {
                                    if (nodeContent.tag === 'img') {
                                        pushImage(articleContent, nodeContent, order, article.id);
                                        order++;
                                    } else if (nodeContent.tag === 'strong' || nodeContent.tag === 'em') {
                                        pushText(
                                            articleContent,
                                            nodeContent.content[0],
                                            nodeContent.tag,
                                            order,
                                            article.id
                                        );
                                        order++;
                                    }
                                } else {
                                    //nodeContent.tag = undefined
                                    pushText(articleContent, nodeContent, node.tag, order, article.id);
                                    order++;
                                }
                            });
                        } else if (node.tag === 'blockquote') {
                            node.content.forEach(nodeContent => {
                                if (nodeContent.hasOwnProperty('tag')) {
                                    if (nodeContent.tag === 'p') {
                                        nodeContent.content.forEach(content => {
                                            if (content.tag === 'img') {
                                                pushImage(articleContent, content, order, article.id);
                                                order++;
                                            } else if (content.tag === 'br') {
                                                //do nothing
                                            } else {
                                                pushText(articleContent, content, node.tag, order, article.id);
                                                order++;
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
