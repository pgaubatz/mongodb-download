var os = require('os');
var http = require('https');
var fs = require('fs');
var path = require('path');
var debug = require('debug')('mongodb-download');
var getos = require('getos');
// get os
var DOWNLOAD_URI = "https://fastdl.mongodb.org"; 

module.exports = function (opts, cb) {

	var platform = opts.platform || os.platform();

	var mongo_platform = "";

	switch(platform) {
		case "darwin":
			mongo_platform = "osx";
			break;
		case "win32":
			mongo_platform = "win32";
			break;
		case "linux":
			mongo_platform = "linux";
			break;
		case "sunos":
			mongo_platform = "sunos5";
			break;
		default:
			debug("unsupported platform %s by MongoDB", platform);
			throw new Error("unsupported OS");
	}

	debug("selected platform %s", mongo_platform);
	DOWNLOAD_URI += "/" + mongo_platform;

	var cr_return = "";
	if ( platform === "win32" ) {
		cr_return = "\033[0G";
	} else {
		cr_return = "\r";
	}

	var arch = opts.arch || os.arch();

	if ( arch === "ia32" ) {
		if ( platform === "linux" ) {
			mongo_arch = "i686";
		} else if ( platform === "win32" ) {
			mongo_arch = "i386";
		} else {
			debug("unsupported platform and os combination");
			throw new Error("unsupported architecture");
		}
	} else if ( arch === "x64" ) {
		mongo_arch = "x86_64";
	} else {
		debug("unsupported architecture");
		throw new Error("unsupported architecture, ia32 and x64 are the only valid options");
	}
	
	debug("selected architecture %s", mongo_arch);

	var mongo_version = opts.version || undefined;
	if (! mongo_version ) {
		throw new Error("missing version");
	}
	debug("selected version: %s", mongo_version);

	var name = "mongodb-" + mongo_platform + "-" + mongo_arch;

	if ( mongo_platform === "linux" ) {
		// append distro
		getos(function(e, os) {
			if(e) {
				debug("error", e);
				throw e;
			}
			if ( /ubuntu/i.test(os.dist) ) {
				name += "-ubuntu";
				if ( os.release == "14.04" ) {
					name += "1404";
				} else if ( os.release == "12.04" ) {
					name += "1204";
				} else if ( os.release == "14.10" ) {
					name += "1410-clang";
				} else {
					throw new Error("unsupported release of Ubuntu");
				}
			} else if ( /suse/i.test(os.dist) ) {
				name += "-suse";
				if ( /^11/.test(os.release) ) {
					name += "11";
				} else {
					throw new Error("unsupported release of SUSE");
				}
			} else if ( /rhel/i.test(os.dist) || /centos/i.test(os.dist) || /scientific/i.test(os.dist) ) {
				name += "-rhel";
				if ( /^7/.test(os.release) ) {
					name += "70";
				} else if ( /^6/.test(os.release) ) {
					name += "62";
				} else if ( /^5/.test(os.release) ) {
					name += "55";
				} else {
					throw new Error("unsupported release of RHEL");
				}
			} else if ( /debian/i.test(os.dist) ) {
				name += "-suse";
				if ( /^7/.test(os.release) || /^8/.test(os.release) ) {
					name += "71";
				} else {
					throw new Error("unsupported release of Debian");
				}
			} else {
				throw new Error("unsupported linux distribution");
			}
			name += "-" + mongo_version;
			continueProcess();
		});
	} else {
		name += "-" + mongo_version;
		continueProcess();
	}

	function continueProcess() {
		var mongo_archive = "";
		if ( mongo_platform === "win32" ) {
			mongo_archive = "zip";
		} else {
			mongo_archive = "tgz";
		}
		debug("selected archive %s", mongo_archive);

		name += "." + mongo_archive;
		debug("final name: %s", name);
		DOWNLOAD_URI += "/" + name;
		debug("final download URI: %s", DOWNLOAD_URI);

		var temp_dir = opts.download_dir || os.tmpdir();
		var download_dir = path.resolve(temp_dir, 'mongodb-download');
		// create dir

		try {
	    	fs.mkdirSync(download_dir);
		} catch (e) {
		    if (e.code !== "EEXIST" ) throw e;
		}

		debug("download directory: %s", temp_dir);
		var download_location = path.resolve(download_dir, name);
		
		var temp_download_location = path.resolve(download_dir, name + ".in_progress");
		debug("download complete path: %s", download_location);

		try {
	        var stats = fs.lstatSync(download_location);
			debug("sending file from cache");
			return cb(null, download_location);
	    } catch (e) {
	        if ( e.code !== "ENOENT" ) throw e;
	    }

		var file = fs.createWriteStream(temp_download_location);
		var request = http.get(DOWNLOAD_URI, function(response) {
			var cur = 0;
			var len = parseInt(response.headers['content-length'], 10);
			var total = len / 1048576;

		  	response.pipe(file);
		  	file.on('finish', function() {
	      		file.close(function() {
	      			fs.renameSync(temp_download_location, download_location);
	      			cb(null, download_location);
	      		});
	    	});

			var last_stdout;
	  		response.on("data", function(chunk) {
		        cur += chunk.length;
		        var percent_complete = (100.0 * cur / len).toFixed(1);
		        var mb_complete = (cur / 1048576).toFixed(1);
		        var text_to_print = "Completed: " + percent_complete + 
		        	"% (" + mb_complete + "mb / " + total.toFixed(1) + "mb)" + 
		        	cr_return;
				if (last_stdout !== text_to_print) {
					last_stdout = text_to_print;
					process.stdout.write(text_to_print);
				}
        	});

	        request.on("error", function(e){
	        	debug("request error:", e);
	        	cb(e, null);
	        });
		});
	}

}


				

/*
https://fastdl.mongodb.org/osx/mongodb-osx-x86_64-3.0.6.tgz
https://fastdl.mongodb.org/sunos5/mongodb-sunos5-x86_64-3.0.6.tgz
https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-amazon-3.0.6.tgz
https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian71-3.0.6.tgz
https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-rhel55-3.0.6.tgz
https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-rhel62-3.0.6.tgz
https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-rhel70-3.0.6.tgz
https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-suse11-3.0.6.tgz
https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu1204-3.0.6.tgz
https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu1404-3.0.6.tgz
https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu1410-clang-3.0.6.tgz
https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-3.0.6.tgz
https://fastdl.mongodb.org/linux/mongodb-linux-i686-3.0.6.tgz
https://fastdl.mongodb.org/win32/mongodb-win32-x86_64-3.0.6.zip
https://fastdl.mongodb.org/win32/mongodb-win32-i386-3.0.6.zip
*/
