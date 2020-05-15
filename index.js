const { Keystone } = require('@keystonejs/keystone');
const { PasswordAuthStrategy } = require('@keystonejs/auth-password');
const { GraphQLApp } = require('@keystonejs/app-graphql');
const { AdminUIApp } = require('@keystonejs/app-admin-ui');
const { StaticApp } = require('@keystonejs/app-static');

const initialiseData = require('./initial-data');

const { Release, Article, Tag, People } = require('./schema');
const { staticRoute, staticPath, dbconnection } = require('./config');

const PROJECT_NAME = `"Время открытий"`;
const { KnexAdapter } = require('@keystonejs/adapter-knex');

const adapterConfig = {
    schemaName: 'public',
    dropDatabase: false,
    knexOptions: {
        client: 'postgres',
        connection: dbconnection
    }
};

const keystone = new Keystone({
    name: PROJECT_NAME,
    adapter: new KnexAdapter(adapterConfig),
    onConnect: process.env.CREATE_TABLES !== 'true' && initialiseData
});

keystone.createList('People', People);
keystone.createList('Release', Release);
keystone.createList('Article', Article);
keystone.createList('Tag', Tag);

const authStrategy = keystone.createAuthStrategy({
    type: PasswordAuthStrategy,
    list: 'People'
});

const adminApp = new AdminUIApp({
    enableDefaultRoute: false,
    authStrategy,
    adminPath: '/admin',
    //hooks: [require.resolve('./admin/'), require.resolve('./branding/')]
    //hooks: require.resolve('./branding/'),
    pages: [
        {
            label: 'Газета',
            children: [
                { label: 'Выпуски', listKey: 'Release' },
                { label: 'Статьи', listKey: 'Article' },
                { label: 'Рубрики', listKey: 'Tag' }
            ]
        },
        {
            label: 'Администрирование',
            children: [{ label: 'Пользователи', listKey: 'People' }]
        }
    ]
});

module.exports = {
    keystone,
    apps: [new GraphQLApp(), new StaticApp({ path: staticRoute, src: staticPath }), adminApp]
};
