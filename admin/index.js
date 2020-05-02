import Dashboard from './pages/dashboard';

export default {
    pages: () => [
        {
            label: 'A new dashboard',
            path: '',
            component: Dashboard
        },
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
};
