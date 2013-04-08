/**
backbone-s3 0.0.1 - (c) 2013 Sergio Alcantara
Server side (Node.js) `Backbone.sync()` Amazon S3 implementation

@module S3
@author Sergio Alcantara
 */

var _ = require('underscore'),
	uuid = require('node-uuid'),
	AWS = require('aws-sdk'),
	Backbone = require('./backbone-s3-shared');
_.mixin(require('underscore.deferred'));

var s3 = new AWS.S3();

/**
 * Adding the aws-sdk to Backbone.AWS
 */
Backbone.AWS = AWS;

function wrapComplete(instance, options) {
	var complete = options.complete;
	options.complete = function(resp) {
		if (complete) complete.call(this, instance, resp, options);
	};
}

function putObject(model, options) {
	var changed = {},
		key = _.result(model, 'url'),
		attributes = _.clone(model.attributes);

	if (model.isNew()) {
		if (key.charAt(key.length - 1) !== '/') key += '/';

		var idAttr = _.result(model, 'idAttribute');
		key += encodeURIComponent(attributes[idAttr] = changed[idAttr] = uuid());
	}

	var params = {
		Bucket: _.result(model, 'bucket'),
		Key: key.charAt(0) === '/' ? key.substr(1) : key,
		Body: new Buffer(JSON.stringify(attributes)),
		ContentType: 'application/json'
	};
	_.extend(params, options.s3);

	var dates = [];
	for (var name in attributes) {
		if (attributes.hasOwnProperty(name) && _.isDate(attributes[name])) {
			dates.push(name);
		}
	}
	if (dates.length) {
		params.Metadata = _.extend({}, params.Metadata, {
			'date-attributes': JSON.stringify(dates)
		});
	}

	var deferred = new _.Deferred(),
		request = s3.client.putObject(params);

	request.on('complete', function(resp) {
		var ctx = options.context || model;

		if (resp.error) deferred.rejectWith(ctx, [resp, options]);
		else {
			resp.backboneData = changed;
			deferred.resolveWith(ctx, [resp, options]);
		}
	});
	request.send();

	wrapComplete(model, options);
	deferred.done(options.success).fail(options.error).always(options.complete);

	return deferred.promise(request);
}

function getObjectData(resp) {
	var data = {};
	if (!resp.error) {
		try {
			data = JSON.parse(resp.data.Body.toString());
		} catch (e) {}


		var md = resp.data.Metadata;
		if (md) {
			var dates = [];
			try {
				dates = JSON.parse(md['date-attributes']);
			} catch (e) {}
			_(dates).each(function(name) {
				data[name] = new Date(data[name]);
			});
		}
	}
	
	return data;
}

function getObject(model, options) {
	var key = _.result(model, 'url'),
		params = {
			Bucket: _.result(model, 'bucket'),
			Key: key.charAt(0) === '/' ? key.substr(1) : key
		};
	_.extend(params, options.s3);

	var deferred = new _.Deferred(),
		request = s3.client.getObject(params);

	request.on('complete', function(resp) {
		var ctx = options.context || model;

		if (resp.error) deferred.rejectWith(ctx, [resp, options]);
		else {
			resp.backboneData = getObjectData(resp);
			deferred.resolveWith(ctx, [resp, options]);
		}
	});
	request.send();

	wrapComplete(model, options);
	deferred.done(options.success).fail(options.error).always(options.complete);

	return deferred.promise(request);
}

function deleteObject(model, options) {
	var key = _.result(model, 'url'),
		params = {
			Bucket: _.result(model, 'bucket'),
			Key: key.charAt(0) === '/' ? key.substr(1) : key
		};
	_.extend(params, options.s3);

	var deferred = new _.Deferred(),
		request = s3.client.deleteObject(params);

	request.on('complete', function(resp) {
		var ctx = options.context || model;

		if (resp.error) deferred.rejectWith(ctx, [resp, options]);
		else deferred.resolveWith(ctx, [resp, options]);
	});
	request.send();

	wrapComplete(model, options);
	deferred.done(options.success).fail(options.error).always(options.complete);

	return deferred.promise(request);
}

Backbone.S3.Model = Backbone.S3.Model.extend({
	sync: function(method, model, options) {
		if (method === 'create' || method === 'update') {
			return putObject(model, options);
		} else if (method === 'read') {
			return getObject(model, options);
		}
		return deleteObject(model, options);
	}
});

function fetchCollection(collection, options) {
	var prefix = _.result(collection, 'url'),
		bucket = _.result(collection, 'bucket'),
		params = {Bucket: bucket};

	if (prefix.charAt(0) === '/') prefix = prefix.substr(1);
	if (prefix.charAt(prefix.length - 1) !== '/') prefix += '/';
	params.Prefix = prefix;

	var deferred = new _.Deferred(),
		request = s3.client.listObjects(params);

	request.on('complete', function(resp) {
		var ctx = options.context || collection;

		if (resp.error) deferred.rejectWith(ctx, [resp, options]);
		else {
			resp.getObjectRequests = [];
			resp.getObjectResponses = [];
			_(resp.data.Contents).each(function(obj) {
				var dfd = new _.Deferred(),
					req = s3.client.getObject({Key: obj.Key, Bucket: bucket});

				req.on('complete', function(res) {
					if (res.error) dfd.rejectWith(ctx, [res, options]);
					else {
						res.backboneData = getObjectData(res);
						dfd.resolveWith(ctx, [res, options]);
					}
				});
				req.send();

				resp.getObjectRequests.push(dfd.promise(req));
			});

			_.when(resp.getObjectRequests).always(function() {
				var backboneData = [],
					args = Array.prototype.slice.call(arguments);

				_.each(args, function(arg) {
					var getObjectResponse = arg[0];
					resp.getObjectResponses.push(getObjectResponse);

					var data = {backboneData: getObjectData(getObjectResponse)};
					backboneData.push(data);
				});

				resp.backboneData = backboneData;
			}).done(function() {
				deferred.resolveWith(ctx, [resp, options]);
			}).fail(function() {
				deferred.rejectWith(ctx, [resp, options]);
			});
		}

	});
	request.send();

	wrapComplete(collection, options);
	deferred.done(options.success).fail(options.error).always(options.complete);

	return deferred.promise(request);
}

Backbone.S3.Collection = Backbone.S3.Collection.extend({
	sync: function(method, collection, options) {
		return fetchCollection(collection, options);
	}
});

module.exports = Backbone;