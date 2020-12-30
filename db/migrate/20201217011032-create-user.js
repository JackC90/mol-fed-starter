"use strict";
const { onUpdateTrigger } = require("../../config/database");

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable(
			"users",
			{
				id: {
					allowNull: false,
					primaryKey: true,
					type: Sequelize.UUID,
					defaultValue: Sequelize.literal("uuid_generate_v4()"),
				},
				username: {
					type: Sequelize.STRING,
					allowNull: false,
					unique: true,
				},
				email: {
					type: Sequelize.STRING,
					allowNull: false,
					unique: true,
				},
				full_name: {
					type: Sequelize.STRING,
				},
				password: {
					type: Sequelize.STRING,
				},
				user_type: {
					type: Sequelize.ENUM,
					values: ["admin", "user"],
					allowNull: false,
					defaultValue: "user",
				},
				country_code: {
					type: Sequelize.STRING,
				},
				account_source: {
					type: Sequelize.ENUM,
					values: ["app", "google"],
					allowNull: false,
					defaultValue: "app",
				},
				is_verified: {
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue: false,
				},
				delete_flag: {
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue: false,
				},
				created_at: {
					allowNull: false,
					type: "TIMESTAMP",
					defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
				},
				updated_at: {
					allowNull: false,
					type: "TIMESTAMP",
					defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
				},
			},
			{
				schema: "accounts",
			}
		);

		await queryInterface.sequelize.query(
			onUpdateTrigger("users", "accounts")
		);
	},
	down: async (queryInterface) => {
		await queryInterface.dropTable("users", {
			schema: "accounts",
		});
	},
};
