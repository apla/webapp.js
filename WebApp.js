// support loading for external resources such as big sencha css
// and js with progress bar


// TODO: add ability to display progress bar

// TODO: add support for extjs loading

function MakeEl (name, attributes) {
	var el = document.createElement (name);
	if (typeof attributes == 'object') {
		for (var i in attributes) {
			el.setAttribute (i, attributes[i]);

			if (i.toLowerCase() == 'class') {
				el.className = attributes[i];  // for IE compatibility

			} else if (i.toLowerCase() == 'style') {
				el.style.cssText = attributes[i]; // for IE compatibility
			}
		}
	}
	for (var i = 2; i<arguments.length; i++) {
		var val = arguments[i];
		if (typeof val == 'string')
			val = document.createTextNode( val );
		if (el && el.appendChild)
			el.appendChild (val);
	}
	return el;
}

WebApp = {};

WebApp.Loader = function (config) {

	var self = this;
	
	var $document = document;
	var $window = window;
	var $addEventListener = 'addEventListener';
	
	this.quiet = config.quiet || false;
	
	this.l10n = config.l10n || {loading: 'Loading…', rendering: 'Rendering…'};
	
	this.res = config.res || [];
	
	this.tasks = new function () {
//		var t = {};
//		this.items = t;
		this.completion = function () {
			var d = 0, a = 0;
			for (var k in this) {
				if (! this.byUrl (k))
					continue;
//				console.log (k, this[k].state);
				a ++;
				if (this[k].state == 4) d ++;
			}
			
//			console.log (d, a);
			
			return d / a;
		};
		this.byUrl = function (url) {
			return (this[url] == this.add || this[url] == this.byUrl || this[url] == this.completion ? null : this[url]);
		};
		this.add = function (url, conf) {
			this[url] = new WebApp.Loader.Task (url, conf);
		}

	};
	
	for (var resUrl in this.res) {
		this.tasks.add (resUrl, this.res[resUrl]);
	}

	this.cb = config.cb;
	
	this.slotCount = null;

	this.isLoading = false;
	this.loadMore  = false;
	this.isDone    = false;
	// if ($window[$addEventListener]) 
	//$window[$addEventListener] ("error", function (eee) {
		//console.error (eee);
		// self.completed ();
	// }, false);

	this.begin = function () {
		this.progress = new WebApp.Loader.Progress ({l10n: this.l10n});
		
		if (!this.quiet)
			this.progress.show ();
		
		this.load ();
	}
	
	this.enqueueResources = function (res) {

		for (var url in res) {
			this.tasks.add (url, res[url]);
		}

		if (this.isLoading)
			this.loadMore = true;
		else
			this.load ();
		
		if (!this.quiet) {
			this.progress.update (this.tasks.completion ());
		}

	}

	this.load = function () {
		
		if (this.tasks.completion () == 1 || this.isLoading)
			return;
		
		this.isLoading = true;
		
		var canContinue = 0;
		var require = {};
		
		for (var taskUrl in this.tasks) {
			
			var task = this.tasks.byUrl (taskUrl);
			
			if (!task) continue;
			
//			console.log (task, this.tasks, taskUrl);
			
			task.checkState();
			
//			console.log (task.state);
			
			if (task.isReady()) {
				canContinue ++;
				task.run ();
			} else if (task.isRunning()) {
				canContinue ++;
			} else {
				require[task.url] = task.require;
			}
		}
		
		if (!canContinue)
			console.error ("there is no way to resolve dependencies", require);
		
		this.isLoading = false;
		
		if (this.loadMore)
			setTimeout (function () {
				self.load();
			}, 0);
	}
	
	this.taskDone = function (task) {
		// delete this.tasks[task.url];
		
		console.log (task.url, '' + ~~ (this.tasks.completion () * 100) + '% done');
		if (this.isLoading)
			this.loadMore = true;
		else
			this.load ();
		
		if (!this.quiet) {
			this.progress.update (this.tasks.completion ());
		}
		
		if (this.tasks.completion () == 1 && !this.isDone) {
			this.isDone = true;
			this.cb (this);
		}
	}
	
	this.done = function () {
		if (!this.quiet) {
			this.progress.hide ();
		}
		
	};
	
	console.log ('WebApp Init phase');
	
	// offline cache handling
	
	if ($window.applicationCache) {
		
		var cache = $window.applicationCache;
		
		var updateCacheStatus = function () {
			if (cache.status == 4) {
				cache.swapCache ();
			}
		}

		var updateCacheError = function (e) {
//			console.log(e, cacheStates[cache.status]);
		}


		var events = "checking,noupdate,downloading,progress,updateready,cached,obsolete".split(',');
		var i = events.length;

		while (i--) {
			cache[$addEventListener](events[i], updateCacheStatus, false);
		}
		
		cache[$addEventListener]('error', updateCacheError, false);
	}
	
	//flag to indicate whether target function has already been run
	WebApp.Loader.ready = 0;
	
	WebApp.Loader.instance = this;
	
	if ($document[$addEventListener]) {
		$document[$addEventListener]("DOMContentLoaded", function() {
			WebApp.Loader.ready ++;
			if (WebApp.Loader.ready == 1) self.begin()
			window.onload = null;
		}, false)
	} else if ($document.all && !window.opera) {
		$document.write('<script type="text/javascript" id="contentloadtag" defer="defer" src="javascript:void(0)"><\/script>')
		var contentloadtag = $document.getElementById ("contentloadtag")
		contentloadtag.onreadystatechange = function(){
			if (self.readyState == "complete"){
				WebApp.Loader.ready ++;
				if (!WebApp.Loader.ready == 1) self.begin()
				window.onload = null;
			}
		}
	}

	$window.onload = function () {
		setTimeout("if (!WebApp.Loader.ready) WebApp.Loader.instance.begin()", 0)
	}
	
}

WebApp.Loader.Task = function (url) {

	var $a = arguments;
	var $document = document;
	var $window = window;
	var $addEventListener = 'addEventListener';
	var $querySelector = 'querySelector';
	
	this.url       = $a[0];

	// parameters parse:
	if ($a.length == 2 && $a[1] instanceof Object) {
		this.require     = $a[1].require;
		this.type        = $a[1].type;
		this.mustProduce = $a[1].mustProduce;
		this.cb          = $a[1].cb;
		this.cbScope     = $a[1].cbScope;
		
	} else {
		this.require   = $a[1];
		this.type      = $a[2];
	}
	
	if (!this.type)
		this.type = this.url.match (/\.(js|css)$/)[1];
	
	var stateList = ['scarce', 'ready', 'running', 'idle', 'complete', 'failed'];
	
	var self = this;
	
	this.state = 0;
	
	for (var stateNum = 0; stateNum < stateList.length; stateNum++) {
		
		var fName = 'is' + stateList[stateNum].toLowerCase().replace(/\b([a-z])/i,function(c){return c.toUpperCase()});
		this[fName] = function (x) {
			return function () {return self.state == x};
		} (stateNum);
	}
	
	this.prepareNode = function () {
		if (this.type == 'js') {
			this.nodeName = 'script';
			this.nodeAttrs = {
				type: 'text/javascript',
				src: this.url
			};
		} else if (this.type == 'css') {
			this.nodeName = 'link';
			this.nodeAttrs = {
				type: 'text/css',
				href: this.url,
				rel: 'stylesheet'
			};
		}
	}
	
	this.checkState = function () {
		
		var require = this.require;
		
		if (!require && this.state == 0) {
			this.state = 1;
		}
		
		if (this.state >= 1)
			return this.state;
		
		var satisfy = 0;
		try {satisfy = eval ("if ("+ (require instanceof Array ? require.join (' && ') : require)+") 1") } catch (e) {};
		if (satisfy) {
			this.state = 1;
			return this.state;
		}
		
		return this.state;
	}

	this.prepareNode ();
	var state = this.checkState ();
//	console.log (this.url, 'state is', stateList[state], ' (' + state + ')', (state == 0 ? (this.require instanceof Array ? this.require.join (', ') : this.require) : ''));
	
	this.completed = function () {
		this.state = 4;
		
		var mustProduce = this.mustProduce;
		
		if (mustProduce) {
			var checkString = (mustProduce instanceof Array ? mustProduce.join (' && ') : mustProduce);
			var satisfy = 0;
			try {satisfy = eval ("if ("+ checkString +") 1") } catch (e) {};
			if (!satisfy) {
				// TODO: WebApp.Loader.instance.taskError (this);
				console.error ("task " + this.url + " must produce " + checkString + " but it doesn't");
				// TODO: return;
			}
		}
		
		// coroutine call
		if (this.cb) {
//			console.log ('cb defined', this.cb, this.cbScope);
			
			this.cb.call (this.cbScope || this, this);
		}
		
		WebApp.Loader.instance.taskDone (this);
	}
	
	this.run = function () {
		
		if (this.state != 1) return;
		
		this.state = 2;
		
		var node = MakeEl (this.nodeName, this.nodeAttrs);
		
		//console.log (nodeName);
		// we add events for any browser who supports events
		if (node[$addEventListener]) {
			node[$addEventListener]("load", function () {
				self.completed ();
			}, false);
			node[$addEventListener]("error", function (event) {
				console.log (event);
			}, false);

		} else {
			node.onreadystatechange = function() {
				if (this.readyState == "complete" || this.readyState == "loaded")
					self.completed ();
			}
		}
		// but event doesn't call in gecko, webkit
		if (this.nodeName == 'link') {
			
			// TODO: use solution from http://www.backalleycoder.com/2011/03/20/link-tag-css-stylesheet-load-event/:
			var loadCSS = function(url, callback){

				var html = $document[$querySelector]('html')[0];
				var img = MakeEl ('img');
				img.onerror = function(){
					if(callback) callback(link);
					html.removeChild(img);
				}

				html.appendChild(img);
				img.src = url;
			}

			//console.log ('node before timer ', node, node.sheet);
			var _timer = setInterval(function () {
				try {
					//var t;
					//for (var k in node.sheet) {
					//	t += k + ' => ' + node.sheet[k] + ', '
					//}

					// console.log ('node within timer ', node, node.sheet);
					var cssLoaded = 0;
					if (node.sheet && node.sheet.cssRules.length > 0 )
						cssLoaded = 1;
					else if (node.styleSheet && node.styleSheet.cssText.length > 0 )
						cssLoaded = 1;
					else if (node.innerHTML && node.innerHTML.length > 0 )
						cssLoaded = 1;
				} catch (ex) {
					// we hope firefox return exception because css located on another domain
					// TODO: check for domain
					if (ex.name == 'NS_ERROR_DOM_SECURITY_ERR')
						cssLoaded = 1;
					// console.log (ex)
				}
				if (cssLoaded || self.isCompleted ()) {
					// console.log ('css loaded');
					clearInterval(_timer);
					self.completed ();
				}
			}, 50)
		}
		
		$document[$querySelector]("head").appendChild(node);

	}
				
}

WebApp.Loader.Progress = function (config) {
	
	var self = this;
	
	var $document = document;
	var $window = window;
	var $addEventListener = 'addEventListener';
	var $innerHeight = 'innerHeight';
	var $innerWidth  = 'innerWidth';
	
	this.l10n = config.l10n;
	
	this.show = function () {
		var body      = $document.body;
		var bodyStyle = body.style;
		
		// var node = document.createElement(this.nodeName);
		//var body = $document.getElementsByTagName("body").item(0);
		
		bodyStyle.width  = $window[$innerWidth] + 'px';
		bodyStyle.height = $window[$innerHeight] + 'px';
		
		// console.log (~~(window[$innerHeight]/2));
		
		//if (resources[type+'-'+version])
		var node = MakeEl ('div', {
			id: 'web-app-progress',
			style: 'font-family: "Helvetica Neue",HelveticaNeue,"Helvetica-Neue",Helvetica,sans-serif; -webkit-transition: opacity linear 2s; -moz-transition: opacity linear 2s; text-align: center; padding: 10px; border-radius: 10px; background: rgba(192, 192, 192, 0.3); height: 50px; width: 300px; text-align: left; position: absolute !important; z-index: 100; top: '+(~~(window[$innerHeight]/2))+'px; left: 50%; margin: -25px 0 0 -150px; display: block;'
		}, this.l10n.loading);
		
		body.insertBefore(node, body.firstChild);

		var nodeProgress = MakeEl ('div', {
			'class': '',
			style: 'background: -moz-linear-gradient(top,  #2986d6,  #1d5e96); background: -webkit-gradient(linear, 0% 0%, 0% 100%, color-stop(0%, #7fb6e7), color-stop(2%, #2986d6), color-stop(100%, #1d5e96)); -moz-transition: width linear 0.3s; -webkit-transition: width linear 0.3s; height: 8px; border-radius: 5px; width: 0; display: block;'
		});
		
		node.appendChild (nodeProgress);
		
		node.style.display = 'none';
		node.style.display = 'block';

		body.scrollTop = body.scrollHeight;
		bodyStyle.width  = $window[$innerWidth] + 'px';
		bodyStyle.height = $window[$innerHeight] + 'px';

		// nodeProgress.style.width = '1px';
		this.boxNode = node;
		this.barNode = nodeProgress;
		
		this.scrollChecker = setInterval (function (){
			//console.log ('pageYOffset: ' + window.pageYOffset);
			if ($window.pageYOffset > 0) {
				self.onReflow();
			}
		}, 50);
	}
	
	this.update = function (progress) {
		this.barNode.style.width = ~~ (progress * 100) + '%';
		
		if (progress == 1) {
			this.boxNode.firstChild.textContent = this.l10n.rendering;
		}
	}
	
	this.onReflow = function () {
		if (~~($window[$innerHeight]/2) + $window.pageYOffset != self.boxNode.offsetTop){
			this.boxNode.style.top  = ~~($window[$innerHeight]/2) + $window.pageYOffset + 'px'
			this.boxNode.style.left = ~~($window[$innerWidth]/2)  + $window.pageXOffset + 'px'
		}
		
		console.log ($window.offsetHeight, $window[$innerHeight], $window.clientHeight, $window);
		
		//console.log ('iH: ' + ~~(window[$innerHeight]/2) + ' pageYOffset: ' + window.pageYOffset);
		//console.log ('offsetTop: ' + self.boxNode.offsetTop);

	}
	
	this.hide = function () {
//		console.log ('!!!!!!!!!!!!!!');
		this.boxNode.style.opacity = 0;
		this.boxNode[$addEventListener]('webkitTransitionEnd', this.afterHide, false);
		//clearInterval(this.scrollChecker);
	};
	
	this.afterHide = function () {
//		console.log ('??????????????????');
		clearInterval(self.scrollChecker);
	}


}

