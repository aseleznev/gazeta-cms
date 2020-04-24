const dev = process.env.NODE_ENV === 'development';

module.exports = {
    port: process.env.PORT || 3000,
    staticRoute: '/uploads', // The URL portion
    staticPath: 'uploads', // The local path on disk
    distDir: 'dist',
    acceptorUrl: dev ? 'https://newspaper-dev.gp-ggr.ru/ac' : 'http://localhost:8080',
    acceptorProxyUrl: dev ? '//newspaper-dev.gp-ggr.ru' : '//localhost:8080',
    backendUrl: dev ? 'https://newspaper-dev.gp-ggr.ru/api' : 'http://localhost:3001/api',
    tinyMceBaseUrl: dev ? '/admin/tinymce-assets' : '/tinymce-assets',
    dbconnection: dev ? 'postgres://cms:cms@localhost/gazeta_cms' : 'postgres://localhost/gazeta_cms2'
};
