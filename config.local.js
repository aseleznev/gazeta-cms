const dev = process.env.NODE_ENV === 'development';
const prod = process.env.NODE_ENV === 'production';

module.exports = {
    port: 3000,
    staticRoute: '/uploads', // The URL portion
    staticPath: '../gazeta-upload', // The local path on disk
    distDir: 'dist',
    host: '//localhost:3000',
    backendUrl: 'http://localhost:3001/api',
    tinyMceBaseUrl: '/tinymce-assets',
    dbconnection: 'postgres://localhost/gazeta_cms3',
    apiKey: 'f44d32aa-5a77-4363-b190-ea1f8d2a658d',
    cookieSecret: 'c68ab997285c70f0f9b59281b34fbc2c717de2597fb0b1d2c4049d56aa8b6050'
};
