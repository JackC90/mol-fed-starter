const schema = process.env.ACCOUNTS_SCHEMA;

const criteria = [
	{
		name: "length",
		message: "At least 8 characters",
		check: (val) => val.length >= 8,
	},
	{
		name: "letter",
		message: "At least an upper and a lower case letter",
		check: (val) => val.match(/[a-z].*[A-Z]|[A-Z].*[a-z]/),
	},
	{
		name: "number",
		message: "At least one number (0 – 9)",
		check: (val) => val.match(/\d+/),
	},
	{
		name: "symbol",
		message: "At least one symbol",
		check: (val) => val.match(/[$&+,:;=?@#|'<>.^*()%!-]/),
	},
];

const validatePassword = (value) => {
	if (!value) {
		throw Error("Password is required.");
	}
	for (let i = 0, len = criteria.length; i < len; ++i) {
		let { message, check } = criteria[i];
		if (!check(value)) {
			throw Error(`Password invalid: ${message}`);
		}
	}
	return true;
};

const fetchUser = async (props, pgClient) => {
	let fields = [];
	let values = [];

	let i = 1;
	for (const [key, value] of Object.entries(props)) {
		fields.push(`${key} = $${i}`);
		values.push(value);
		i += 1;
	}
	const conditions = fields.join(" and ");

	const {
		rows: [user],
	} = await pgClient.query(
		`select ${schema}.users.* from ${schema}.users where ${conditions}`,
		values
	);
	return user;
};

const validateUser = async (id, pgClient) => {
	const user = fetchUser({ id }, pgClient);
	if (!user || user.flag_delete) {
		return null;
	}
	return user;
};

module.exports = {
	validatePassword,
	fetchUser,
	validateUser,
};
