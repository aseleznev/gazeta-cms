const express = require('express');
const { staticRoute, port, ssl, key, cert } = require('./config');
const { keystone, apps } = require('./index.js');
const { join } = require('path');
const multer = require('multer');
const https = require('https');
const http = require('http');
const fs = require('fs');

keystone
    .prepare({
        apps: apps,
        dev: process.env.NODE_ENV !== 'production'
    })
    .then(async ({ middlewares }) => {
        await keystone.connect();
        const app = express();
        const storage = multer.diskStorage({
            destination: function(req, file, cb) {
                cb(null, join(__dirname, 'gazeta-upload'));
            },
            filename: function(req, file, cb) {
                cb(null, file.originalname);
            }
        });

        const upload = multer({ storage });

        app.post('/admin/image-upload', upload.single('file'), (req, res) => {
            //console.warn(req.file);
            //console.warn(req.body);
            res.send({ location: `//${req.headers.host}${staticRoute}/${req.file.originalname}` });
        });
        app.use(express.json({ limit: '50mb' }));
        app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));
        app.use(middlewares);

        if (ssl) {
            const httpServer = http.createServer(app);
            const httpsServer = https.createServer(
                {
                    cert: fs.readFileSync(cert),
                    key: fs.readFileSync(key)
                },
                app
            );
            httpServer.listen(3000);
            httpsServer.listen(443);
        } else {
            app.listen(port);
        }
    });
