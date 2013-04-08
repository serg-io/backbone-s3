/**
This module is inteded to contain functionality that can be shared between client and server side

@module S3
@submodule S3-Shared
@author Sergio Alcantara
 */

if (typeof require === 'function') {
	var _ = _ || require('underscore');
	var Backbone = Backbone || require('backbone');
}

function bindContext(opts){
	if (opts) {
		var ctx = opts.context || this;
		if (opts.error) opts.error = _.bind(opts.error, ctx);
		if (opts.success) opts.success = _.bind(opts.success, ctx);
	}
	return opts;
}

var isISODate = /^\d{4}(-\d{2}){2}T\d{2}(:\d{2}){2}\.\d{3}Z$/;

Backbone.S3 = {
	isISODate: isISODate,

	/**
	@class Backbone.S3.Model
	@extends Backbone.Model
	 */
	Model: Backbone.Model.extend({
		_bindContext: bindContext,
		/**
		Using the [jQuery.ajax](http://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings) `context` option doesn't work on
		the `success` and `error` callbacks in the original Backbone `save()`, `destroy()`, and `fetch()` methods. This method is overwritten
		to fix that issue.

		@method save
		@param {Object} attributes
		@param {Object} options
		 */
		save: function(attributes, options) {
			return Backbone.Model.prototype.save.call(this, attributes, this._bindContext(options));
		},
		/**
		Using the [jQuery.ajax](http://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings) `context` option doesn't work on
		the `success` and `error` callbacks in the original Backbone `save()`, `destroy()`, and `fetch()` methods. This method is overwritten
		to fix that issue.

		@method destroy
		@param {Object} options
		 */
		destroy: function(options) {
			return Backbone.Model.prototype.destroy.call(this, this._bindContext(options));
		},
		/**
		Using the [jQuery.ajax](http://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings) `context` option doesn't work on
		the `success` and `error` callbacks in the original Backbone `save()`, `destroy()`, and `fetch()` methods. This method is overwritten
		to fix that issue.

		@method fetch
		@param {Object} options
		 */
		fetch: function(options) {
			return Backbone.Model.prototype.fetch.call(this, this._bindContext(options));
		},
		toJSON: function(options) {
			var json = Backbone.Model.prototype.toJSON.call(this, options);

			if (options) {
				if (options.pick) json = _.pick(json, options.pick);
				else if (options.omit) json = _.omit(json, options.omit);
			}

			return {backboneData: json};
		},
		/**
		Iterates through the given attributes looking for `Date` values that have been converted into string, and converts them back to `Date` instances.

		@method parse
		@param {Object} obj
		@return {Object} Parsed attributes
		 */
		parse: function(obj) {
			var m = obj.backboneData;
			for (var k in m) if (isISODate.test(m[k])) m[k] = new Date(m[k]);
			return m;
		}
	}),

	/**
	@class Backbone.S3.Collection
	@extends Backbone.Collection
	 */
	Collection: Backbone.Collection.extend({
		_bindContext: bindContext,
		/**
		Using the [jQuery.ajax](http://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings) `context` option doesn't work on
		the `success` and `error` callbacks in the original Backbone `save()`, `destroy()`, and `fetch()` methods. This method is overwritten
		to fix that issue.

		@method save
		@param {Object} options
		 */
		fetch: function(options) {
			return Backbone.Collection.prototype.fetch.call(this, this._bindContext(options));
		},
		toJSON: function(options) {
			return {
				backboneData: Backbone.Collection.prototype.toJSON.call(this, options)
			};
		},
		parse: function(obj) {
			// Backbone passes each object in the collection through model.parse when instantiating the Models
			return obj.backboneData;
		}
	})
};

if (typeof module !== 'undefined') module.exports = Backbone;