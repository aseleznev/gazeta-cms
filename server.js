const express = require('express');
const { staticRoute, staticPath, acceptorUrl, port } = require('./config');
const { keystone, apps } = require('./index.js');

keystone
    .prepare({
        apps: apps,
        dev: process.env.NODE_ENV !== 'production'
    })
    .then(async ({ middlewares }) => {
        await keystone.connect();
        const app = express();
        const multer = require('multer');
        const storage = multer.diskStorage({
            destination: function(req, file, cb) {
                cb(null, staticPath);
            },
            filename: function(req, file, cb) {
                cb(null, file.originalname);
            }
        });

        const upload = multer({ storage });

        app.post('/admin/image-upload', upload.single('file'), (req, res) => {
            console.warn(req.file);
            console.warn(req.body);
            res.send({ location: `//${req.headers.host}${staticRoute}/${req.file.originalname}` });
        });

        app.use(middlewares).listen(port);
    });
