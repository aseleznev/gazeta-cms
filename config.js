const dev = process.env.NODE_ENV === 'development';
const prod = process.env.NODE_ENV === 'production';

module.exports = {
    port: process.env.PORT || 3000,
    staticRoute: '/uploads', // The URL portion
    staticPath: 'gazeta-upload', // The local path on disk
    distDir: 'dist',
    host: prod ? '//gazeta.gn.com.ru' : dev ? '//newspaper-dev.gp-ggr.ru' : '//localhost:3000',
    backendUrl: prod
        ? 'https://gazeta.gn.com.ru/api'
        : dev
        ? 'https://newspaper-dev.gp-ggr.ru/api'
        : 'http://localhost:3001/api',
    tinyMceBaseUrl: prod || dev ? '/tinymce-assets' : '/tinymce-assets',
    dbconnection: prod
        ? 'postgres://cms:cms@localhost/gazeta_cms'
        : dev
        ? 'postgres://cms:cms@localhost/gazeta_cms'
        : 'postgres://localhost/gazeta_cms3',
    apiKey: 'f44d32aa-5a77-4363-b190-ea1f8d2a658d',
    cookieSecret: 'c68ab997285c70f0f9b59281b34fbc2c717de2597fb0b1d2c4049d56aa8b6050',
    ssl: prod,
    cert: '/etc/ssl/certs/ssl-cert-snakeoil.pem',
    key: '/etc/ssl/private/ssl-cert-snakeoil.key'
};
