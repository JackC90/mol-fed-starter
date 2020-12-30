"use strict";
const ApolloGatewayService = require("../mixins/Apollo/ApolloGatewayService.mixin");

module.exports = {
	name: "api",
	mixins: [ApolloGatewayService],
	settings: {
		port: process.env.PORT || 3030,
	},
};
