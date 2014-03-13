function pi(num,callback){
	var inside = 0, outside = 0;
	for(var i=0;i<num;i++) {
		var x = Math.random();
		var y = Math.random();
		if (x*x+y*y <= 1) {
			inside++;
		} else {
			outside++;
		}
	}
	callback(inside,outside,num);
}

require("../../lib/RedisRPC").wrap({pi: pi});