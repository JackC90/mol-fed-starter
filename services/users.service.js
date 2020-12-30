"use strict";
const PostgraphileService = require("../mixins/Postgraphile/PostgraphileService.mixin");
const CacheCleanerMixin = require("../mixins/cache.cleaner.mixin");

module.exports = {
	name: "users",
	settings: {
		port: 3041,
	},
	mixins: [
		CacheCleanerMixin([`cache.clean.${this.name}`]),
		PostgraphileService,
	],
};
