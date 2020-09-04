const { backendUrl, apiKey } = require('./config');

const fs = require('fs');
const { join } = require('path');
const FormData = require('form-data');
const bcrypt = require('bcrypt');
const qt = require('quickthumb');
const fetch = require('node-fetch');

let agent = null;
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production') {
    const HttpsProxyAgent = require('https-proxy-agent');
    agent = new HttpsProxyAgent({ host: 'webproxytmn.adm.ggr.gazprom.ru', port: 8080 });
}

const getImage = async (originalFilename, filename) => {
    return new Promise((resolve, reject) => {
        const file = join(__dirname, 'gazeta-upload', originalFilename);
        const convertedFile = join(__dirname, 'gazeta-upload', filename);
        //проверим наличие файла
        fs.access(file, fs.constants.F_OK, err => {
            if (err) {
                console.warn(err);
                reject(err);
            }
            resolve(file);
        });
        //поищем уже сконвертированный файл
        // fs.access(convertedFile, fs.constants.F_OK, err => {
        //     if (err) {
        //         try {
        //             qt.convert({ src: file, dst: convertedFile, width: 1000 }, (err, path) => {
        //                 if (err) {
        //                     console.warn(err);
        //                     reject(err);
        //                 }
        //                 resolve(path);
        //             });
        //         } catch (err) {
        //             console.log('convert err file', file);
        //             reject(file);
        //         }
        //     } else {
        //         resolve(convertedFile);
        //     }
        // });
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
        //throw err;
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

            // promises.push(
            //     fetch(`${backendUrl}/release`, {
            //         agent,
            //         method: 'POST',
            //         body: JSON.stringify(release),
            //         headers: { 'Content-Type': 'application/json', apiKey: hashedApiKey }
            //     })
            // );

            fetch(`${backendUrl}/release`, {
                agent,
                method: 'POST',
                body: JSON.stringify(release),
                headers: { 'Content-Type': 'application/json', apiKey: hashedApiKey }
            })
                .then(res => res.json())
                .then(json => console.log(json));

            if (release.image) {
                // await pushImagePost(promises, release.image.originalFilename, release.image.filename);

                try {
                    const hashedApiKey = await bcrypt.hash(apiKey, 10);
                    const formData = new FormData();
                    const file = await getImage(release.image.originalFilename, release.image.filename);
                    const readStream = fs.createReadStream(file);
                    formData.append('file', readStream);

                    fetch(`${backendUrl}/image`, {
                        agent,
                        method: 'POST',
                        body: formData,
                        headers: { apiKey: hashedApiKey }
                    })
                        .then(res => res.json())
                        .then(json => console.log(json));
                } catch (err) {
                    console.warn(err);
                    //throw err;
                }
            }

            for (const article of release.articles) {
                if (article.image) {
                    //await pushImagePost(promises, article.image.originalFilename, article.image.filename);
                    try {
                        const hashedApiKey = await bcrypt.hash(apiKey, 10);
                        const formData = new FormData();
                        const file = await getImage(article.image.originalFilename, article.image.filename);
                        const readStream = fs.createReadStream(file);
                        formData.append('file', readStream);

                        fetch(`${backendUrl}/image`, {
                            agent,
                            method: 'POST',
                            body: formData,
                            headers: { apiKey: hashedApiKey }
                        })
                            .then(res => res.json())
                            .then(json => console.log(json));
                    } catch (err) {
                        console.warn(err);
                        //throw err;
                    }
                }
                for (const content of article.content) {
                    if (content.type === 'image') {
                        //await pushImagePost(promises, content.image.originalFilename, content.image.filename);
                        try {
                            const hashedApiKey = await bcrypt.hash(apiKey, 10);
                            const formData = new FormData();
                            const file = await getImage(content.image.originalFilename, content.image.filename);
                            const readStream = fs.createReadStream(file);
                            formData.append('file', readStream);

                            fetch(`${backendUrl}/image`, {
                                agent,
                                method: 'POST',
                                body: formData,
                                headers: { apiKey: hashedApiKey }
                            })
                                .then(res => res.json())
                                .then(json => console.log(json));
                        } catch (err) {
                            console.warn(err);
                            //throw err;
                        }
                    }
                }
            }

            //Promise.allSettled(contentPromises).then(results => results.forEach(result => console.warn(result.status)));
            // resolve(Promise.all(promises).then(results => results));
            resolve(true);
        });
    }
};
