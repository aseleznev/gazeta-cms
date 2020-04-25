const dev = process.env.NODE_ENV === 'development';

module.exports = {
    port: process.env.PORT || 3000,
    staticRoute: '/uploads', // The URL portion
    staticPath: 'uploads', // The local path on disk
    distDir: 'dist',
    host: dev ? '//newspaper-dev.gp-ggr.ru' : '//localhost:3000',
    backendUrl: dev ? 'https://newspaper-dev.gp-ggr.ru/api' : 'http://localhost:3001/api',
    tinyMceBaseUrl: dev ? '/admin/tinymce-assets' : '/tinymce-assets',
    dbconnection: dev ? 'postgres://cms:cms@localhost/gazeta_cms' : 'postgres://localhost/gazeta_cms2'
};
