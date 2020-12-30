"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
	class User extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			// define association here
		}
	}
	User.init(
		{
			id: {
				type: DataTypes.UUID,
				primaryKey: true,
			},
			username: {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
			},
			email: {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
			},
			fullName: DataTypes.STRING,
			password: {
				type: DataTypes.STRING,
			},
			userType: {
				type: DataTypes.ENUM,
				values: ["admin", "user"],
				allowNull: false,
				defaultValue: "admin",
			},
			countryCode: DataTypes.STRING,
			accountSource: {
				type: DataTypes.ENUM,
				values: ["app", "google"],
				allowNull: false,
				defaultValue: "app",
			},
			isVerified: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
			deleteFlag: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
		},
		{
			sequelize,
			modelName: "User",
			underscored: true,
			schema: "accounts",
		}
	);
	return User;
};
