"use strict";
module.exports = {
	up: async (queryInterface) => {
		// UUID
		await queryInterface.sequelize.query(`
			CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
		`);

		// Updated at
		await queryInterface.sequelize.query(`
			CREATE OR REPLACE FUNCTION on_update_timestamp()
			RETURNS trigger AS $$
			BEGIN
				NEW.updated_at = now();
				RETURN NEW;
			END;
			$$ language 'plpgsql'
		`);
	},
	down: async (queryInterface) => {
		await queryInterface.sequelize.query(`
			DROP FUNCTION on_update_timestamp
		`);
	},
};
