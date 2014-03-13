var redis = require("redis");
var uuid = require('node-uuid');

function RedisRPC(optionsOrChannel) {
	if (typeof optionsOrChannel !== "object") {
		this.options = {
			channel: optionsOrChannel
		};
	} else {
		if (!optionsOrChannel.channel) {
			console.error("Need a channel");
		}
		this.options = optionsOrChannel;
	}

	this.options.redisOptions = this.options.redisOptions || {};
	this.options.redisOptions.port = this.options.redisOptions.port || 6379;
	this.options.redisOptions.host = this.options.redisOptions.host || "127.0.0.1";

	this.options.callback = this.options.callback || function() {};
	//this.options.redisOptions.options = this.options.redisOptions.options || {};

	this.subscriber = redis.createClient(this.options.redisOptions.port,this.options.redisOptions.host,this.options.redisOptions.options);
	//this.subscriber.FLUSHDB();

	this.publisher  = redis.createClient(this.options.redisOptions.port,this.options.redisOptions.host,this.options.redisOptions.options);
	this.requestCounter = +(new Date());
	this.respondCallbacks = {};

	this.uniqueId = uuid.v1();
	this.prefix = this.options.channel + ":";
	var self = this;
	this.subscriber.on("message", function(channelEvent, message) {
		var eventComs = channelEvent.split(":");
		var channel = eventComs[0];
		var event = eventComs[1];
		if (channel != self.options.channel) return;

		var data;
		try {
			data = JSON.parse(message);
		} catch (e) {
			console.error("Unable to parse JSON:",message);
			return;
		}

		//IGNORE OWN MESSAGES
		if (!data._from || data._from == self.uniqueId) return;

		switch (event) {
			case "request":
				var method = data.method;
				var args = data.args;

				var argsWithReplacedFunctions = [];
				for(var i=0;i<args.length;i++) {
					if (typeof(args[i]) == "string" && args[i].indexOf("_function:") === 0) {
						var _fnId = args[i].split(":")[1];

						argsWithReplacedFunctions.push(function() {
							var args = Array.prototype.slice.call(arguments, 0);
							var data = {
								_responseTo: _fnId,
								args: args,
								_from: self.uniqueId
							};
							self.emit("response",data);
						});
					} else {
						argsWithReplacedFunctions.push(args[i]);
					}
				}

				if (method == "_getObject") {
					//console.log(self.channel + "GOT OBJECT");
					var handleObject = function(err,obj) {
						//console.log("RESPONDING TO GETOBJECT",method,args);
						var keys = {};
						for (var key in self.obj) {
							keys[key] = typeof(self.obj[key]);
						}
						argsWithReplacedFunctions[0](null,keys);
					};

					if (self.obj) {
						handleObject(null,self.obj);
					} else {
						this.getObjectCallback = handleObject;
					}
					break;
				}


				if (!self.obj) {
					break;
				}

				var fn = self.obj[method];
				if (fn) {
					fn.apply(self.obj,argsWithReplacedFunctions);
				} else {
					//THROW ERROR?
					//TODO RESPOND WITH ERROR CODE FUNCTION UNKNOWN
				}
			break;


			case "response":
				var _id = data._responseTo;
				if (_id === undefined) {
					console.log("DONT KNOW ID");
					break;
				}
				var handler = self.respondCallbacks[_id];
				if (!handler) {
					console.log("RESPONSE UNKNOWN",data);
					break;
				}

				handler.apply(false,data.args);
				break;
		}
	});
	this.subscriber.subscribe(this.prefix+"request");
	this.subscriber.subscribe(this.prefix+"response");
	this.options.callback(this);
}

RedisRPC.prototype.emit = function(event,data) {
	//TODO CHECK USE OF BINARY DATA/PROTOBUF
	var str = JSON.stringify(data);
	/*
	var strkb = str.length/1024;
	if (strkb > 400) {
		//console.log("DANGER BIG DATA",strkb+"kb");
		//console.log(str);
	}
	*/
	this.publisher.publish(this.prefix+event,str);
};

RedisRPC.prototype.request = function(method,args) {
	var argsWithReplacedFunctions = [];
	for(var i=0;i<args.length;i++) {
		if (typeof(args[i]) == "function") {
			var fnId = this.requestCounter++;
			this.respondCallbacks[fnId] = args[i];
			argsWithReplacedFunctions.push("_function:"+fnId);
		} else {
			argsWithReplacedFunctions.push(args[i]);
		}
	}

	var data = {
		method: method,
		args: argsWithReplacedFunctions,
		_from: this.uniqueId
	};

	this.emit("request",data);
};

RedisRPC.prototype.setObject = function(obj) {
	this.obj = obj;
	if (this.getObjectCallback) {
		this.getObjectCallback(null,obj);
		this.getObjectCallback = false;
	}
};

RedisRPC.prototype.getObject = function(callback) {
	var self = this;
	var resolved = false;
	self.getObjectTimer = setInterval(function() {
		self.request("_getObject",[function(err,objectDescriptor) {
			self.getObjectTimer = clearInterval(self.getObjectTimer);
			if (resolved) return;
			resolved = true;

			var wrappedObject = {};
			Object.keys(objectDescriptor).forEach(function(key) {
				var type = objectDescriptor[key];
				if (type == "function") {
					wrappedObject[key] = function() {
						//console.log("REMOTE CALL FOR " + key);
						var args = Array.prototype.slice.call(arguments, 0);

						var argsWithTypes = [];

						for(var i=0;i<args.length;i++) {
							argsWithTypes.push({
								idx: i,
								type: typeof(args[i]),
								value: args[i]
							});
						}

						self.request(key,args);
					};
				}
			});
			callback(err,wrappedObject);
		}]);
	},100);
};

RedisRPC.wrap = function(obj) {
	if (process.argv < 3) {
		console.log("UNABLE TO WRAP, NO CHANNEL KNOWN");
		return;
	}

	var commonIdentifier = process.argv[2];
	RedisRPC.provide(commonIdentifier,obj);
};

RedisRPC.provide = function(channel,obj) {
	var r = new RedisRPC(channel);
	r.setObject(obj);
};

RedisRPC.use = function(channel,callback) {
	if (this.obj) {
		return callback("ALREADY PROVIDING, CANT PROVIDE AND USE AT THE SAME TIME");
	}

	var r = new RedisRPC(channel);
	r.getObject(callback);
};

module.exports = RedisRPC;