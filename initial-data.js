module.exports = async keystone => {
    const {
        data: {
            _allPeoplesMeta: { count }
        }
    } = await keystone.executeQuery(
        `query {
      _allPeoplesMeta {
        count
      }
    }`
    );

    if (count === 0) {
        const password = 'qwerty';
        const email = 'admin@nedra.ru';

        await keystone.executeQuery(
            `mutation initialPeople($password: String, $email: String) {
            createPeople(data: {name: "Admin", email: $email, isAdmin: true, password: $password}) {
              id
            }
          }`,
            {
                variables: {
                    password,
                    email
                }
            }
        );

        console.log(`

User created:
  email: ${email}
  password: ${password}
Please change these details after initial login.
`);
    }
};
