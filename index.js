const { Keystone } = require('@keystonejs/keystone');
const { PasswordAuthStrategy } = require('@keystonejs/auth-password');
const { Text, Checkbox, Password } = require('@keystonejs/fields');
const { GraphQLApp } = require('@keystonejs/app-graphql');
const { AdminUIApp } = require('@keystonejs/app-admin-ui');
const { StaticApp } = require('@keystonejs/app-static');

const initialiseData = require('./initial-data');

const { Release, Article, Tag } = require('./schema');
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

const userIsAdmin = ({ authentication: { item: user } }) => Boolean(user && user.isAdmin);
const userOwnsItem = ({ authentication: { item: user } }) => {
    if (!user) {
        return false;
    }

    return { id: user.id };
};

const userIsAdminOrOwner = auth => {
    const isAdmin = access.userIsAdmin(auth);
    const isOwner = access.userOwnsItem(auth);
    return isAdmin ? isAdmin : isOwner;
};

const access = { userIsAdmin, userOwnsItem, userIsAdminOrOwner };

keystone.createList('People', {
    plural: 'Peoples',
    singular: 'People',
    fields: {
        name: { type: Text },
        email: {
            type: Text,
            isUnique: true
        },
        isAdmin: {
            type: Checkbox,
            access: {
                update: access.userIsAdmin
            }
        },
        password: {
            type: Password
        }
    },
    access: {
        read: access.userIsAdminOrOwner,
        update: access.userIsAdminOrOwner,
        create: access.userIsAdmin,
        delete: access.userIsAdmin,
        auth: true
    }
});

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
    //hooks: require.resolve('./branding/')
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
