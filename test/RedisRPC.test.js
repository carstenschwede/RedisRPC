var should = require('should');
var fork = require("child_process").fork;

describe('RedisRPC', function(){
	var RedisRPC = require("../lib/RedisRPC");

	var commonIdentifier = 100000;

	var child_process = fork("./test/dep/worker_object",[commonIdentifier]);
	process.on("exit", function() {
		child_process.kill();
	});


	var person;

	this.timeout(10000);
	before(function(done) {
		//TODO REPLACE SETTIMEOUT WITH AUTODESTRUCT SETINTERVAL UNTIL CONNECTION IS MOADE
		setTimeout(function() {
			RedisRPC.use(commonIdentifier, function(err,instance) {
				person = instance;
				done(err);
			});
		},0);
	});


	it('should be able to call remote functions', function(done) {
		person.callme(done);
	});


	it('should be able to receive arguments to callback', function(done) {
		person.ping(function(result) {
			result.should.equal("pong");
			done();
		});
	});

	it('should be able to pass arguments to callback', function(done) {
		var k = Math.floor(Math.random()*10000);
		person.echo(k,function(result) {
			result.should.equal(k);
			done();
		});
	});
});