require("dotenv").config();

module.exports = {
	development: {
		url: process.env.PGURL_DEV,
		dialect: "postgresql",
	},
	staging: {
		url: process.env.PGURL_STAGE,
		dialect: "postgresql",
	},
	test: {
		url: process.env.PGURL_TEST,
		dialect: "postgresql",
	},
	production: {
		url: process.env.PGURL,
		dialect: "postgresql",
	},

	// Functions
	onUpdateTrigger: (table, schema) => {
		const sc = schema || "public";
		return `
    CREATE TRIGGER ${sc}__${table}_updated_at
    BEFORE UPDATE ON ${sc}.${table}
    FOR EACH ROW
		EXECUTE PROCEDURE on_update_timestamp();`;
	},
};
