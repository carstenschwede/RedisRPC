var Class = require("./class.js");
var Person = Class.extend({
	add: function(a,b,callback) {
		return callback(a+b);
	},
	callme: function(callback) {
		callback();
	},
	ping: function(callback) {
		callback("pong");
	},
	echo: function(k, callback) {
		callback(k);
	}
});

var person = new Person();


require("../../lib/RedisRPC").wrap(person);