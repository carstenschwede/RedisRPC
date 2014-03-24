var person = {
	callme: function(callback) {
		callback();
	},
	ping: function(callback,callback2) {
		callback("pong");
		if (callback2) {
			callback2("pong2");
		}
	},
	ping2: function(a,b,callback,callback2) {
		callback("pong="+(a+b));
		callback2("pong="+(a*b));
	},
	echo: function(k, callback) {
		callback(k);
	}
};

require("../../lib/RedisRPC").wrap(person);