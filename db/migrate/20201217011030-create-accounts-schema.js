"use strict";
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createSchema("accounts");
	},
	down: async (queryInterface) => {
		await queryInterface.dropSchema("accounts");
	},
};
