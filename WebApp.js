// support loading for external resources such as big sencha css
// and js with progress bar


// TODO: add ability to display progress bar

// TODO: add support for extjs loading

WebApp = {};

WebApp.Loader = function (config) {

	var self = this;
	
	this.quiet = config.quiet || false;
	
	this.messages = config.messages || {loading: 'Loading…', rendering: 'Rendering…'};
	
	this.assets = config.assets || config.resources || [];
	
	this.tasks = {};
	
	for (var assetUrl in this.assets) {
		this.tasks[assetUrl] = new WebApp.Loader.Task (assetUrl, this.assets[assetUrl]);
	}
	
	this.readyCallback = config.readyCallback;
	
	this.slotCount = null;
	this.tasksToComplete = 0;
	this.tasksCompleted = 0;

	for (var k in this.tasks) if (this.tasks.hasOwnProperty(k)) {
		this.tasksToComplete ++;
	}
	
	this.isLoading = false;
	this.loadMore  = false;
	this.isDone    = false;
	
	this.begin = function () {
		this.progress = new WebApp.Loader.Progress (this.messages);
		
		if (!this.quiet)
			this.progress.show ();
		
		this.load ();
	}
	
	this.enqueueResources = function (resources) {

		for (var url in resources) {
			this.tasks[url] = new WebApp.Loader.Task (url, resources[url]);
			this.tasksToComplete ++;
		}

		if (this.isLoading)
			this.loadMore = true;
		else
			this.load ();
		
		if (!this.quiet) {
			this.progress.update (this.tasksCompleted / this.tasksToComplete);
		}

	}

	this.load = function () {
		
		if (this.tasksToComplete == this.tasksCompleted || this.isLoading)
			return;
		
		this.isLoading = true;
		
		var canContinue = 0;
		var requirements = {};
		
		for (var taskUrl in this.tasks) {
			var task = this.tasks[taskUrl];
			task.checkState();
			if (task.isReady()) {
				canContinue ++;
				task.run ();
			} else if (task.isRunning()) {
				canContinue ++;
			} else {
				requirements[task.url] = task.require;
			}
		}
		
		if (!canContinue)
			console.error ("there is no way to resolve dependencies", requirements);
		
		this.isLoading = false;
		
		if (this.loadMore)
			setTimeout (function () {
				self.load();
			}, 0);
	}
	
	this.taskDone = function (task) {
		delete this.tasks[task.url];
		
		this.tasksCompleted ++;
		console.log (task.url, '' + ~~ (this.tasksCompleted / this.tasksToComplete * 100) + '% done');
		if (this.isLoading)
			this.loadMore = true;
		else
			this.load ();
		
		if (!this.quiet) {
			this.progress.update (this.tasksCompleted / this.tasksToComplete);
		}
		
		if (this.tasksCompleted == this.tasksToComplete && !this.isDone) {
			this.isDone = true;
			this.readyCallback (this);
		}
	}
	
	this.done = function () {
		if (!this.quiet) {
			this.progress.hide ();
		}
		
	};
	
	console.log ('WebApp Init phase');
	
	// offline cache handling
	
	if (window.applicationCache) {
		
		cache = window.applicationCache;
		
		updateCacheStatus = function () {
			if (cache.status == 4) {
				cache.swapCache ();
			}
		}

		updateCacheError = function (e) {
//			console.log(e, cacheStates[cache.status]);
		}


		var events = "checking,noupdate,downloading,progress,updateready,cached,obsolete".split(',');
		var i = events.length;

		while (i--) {
			cache.addEventListener(events[i], updateCacheStatus, false);
		}
		
		cache.addEventListener('error', updateCacheError, false);
	}
	
	//flag to indicate whether target function has already been run
	WebApp.Loader.ready = 0;
	
	WebApp.Loader.instance = this;
	
	if (document.addEventListener) {
		document.addEventListener("DOMContentLoaded", function() {
			WebApp.Loader.ready ++;
			if (WebApp.Loader.ready == 1) WebApp.Loader.instance.begin()
			window.onload = null;
		}, false)
	} else if (document.all && !window.opera) {
		document.write('<script type="text/javascript" id="contentloadtag" defer="defer" src="javascript:void(0)"><\/script>')
		var contentloadtag = document.getElementById ("contentloadtag")
		contentloadtag.onreadystatechange = function(){
			if (self.readyState == "complete"){
				WebApp.Loader.ready ++;
				if (!WebApp.Loader.ready == 1) WebApp.Loader.instance.begin()
				window.onload = null;
			}
		}
	}

	window.onload = function () {
		setTimeout("if (!WebApp.Loader.ready) WebApp.Loader.instance.begin()", 0)
	}
	
}

WebApp.Loader.Task = function (url) {
	
	this.url       = arguments[0];
	
	// parameters parse:
	if (arguments.length == 2 && arguments[1] instanceof Object) {
		this.require   = arguments[1].require;
		this.type      = arguments[1].type;
		this.forRender = arguments[1].forRender;
	} else {
		this.require   = arguments[1];
		this.type      = arguments[2];
		this.forRender = arguments[3];
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
		
		if (!this.require && this.state == 0) {
			this.state = 1;
		}
		
		if (this.state >= 1)
			return this.state;
		
		var satisfy = 0;
		try {satisfy = eval ("if ("+ (this.require instanceof Array ? this.require.join (' && ') : this.require)+") 1") } catch (e) {};
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
		WebApp.Loader.instance.taskDone (this);
	}
	
	this.run = function () {
		
		if (this.state != 1) return;
		
		this.state = 2;
		
		var node = document.createElement(this.nodeName);
		
		//console.log (nodeName);
		// we add events for any browser who supports events
		if (node.addEventListener) {
			node.addEventListener("load", function () {
				self.completed ();
			}, false);
		} else {
			node.onreadystatechange = function() {
				if (this.readyState == "complete" || this.readyState == "loaded")
					self.completed ();
			}
		}
		// but event doesn't call in gecko, webkit
		if (this.nodeName == 'link') {
			
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
				if (cssLoaded) {
					// console.log ('css loaded');
					clearInterval(_timer);
					self.completed ();
				}
			}, 50)
		}
		
		for (var k in this.nodeAttrs) {
			node.setAttribute (k, this.nodeAttrs[k]);
		}
		// node.src = src;
		document.getElementsByTagName("head").item(0).appendChild(node);

	}
				
}

WebApp.Loader.Progress = function (messages) {
	
	var self = this;
	
	this.messages = messages;
	
	this.show = function () {
		// var b = document.body;
		
		// var node = document.createElement(this.nodeName);
		var body = document.getElementsByTagName("body").item(0);
		
		body.style.width  = window.innerWidth + 'px';
		body.style.height = window.innerHeight + 'px';
		
		// console.log (Math.floor(window.innerHeight/2));
		
		//if (resources[type+'-'+version])
		var node = document.createElement ('div');
		node.setAttribute ('id', 'web-app-progress');
		node.setAttribute ('style', 'font-family: "Helvetica Neue",HelveticaNeue,"Helvetica-Neue",Helvetica,sans-serif; -webkit-transition: opacity linear 2s; -moz-transition: opacity linear 2s; text-align: center; padding: 10px; border-radius: 10px; background: rgba(192, 192, 192, 0.3); height: 50px; width: 300px; text-align: left; position: absolute !important; z-index: 100; top: '+(Math.floor(window.innerHeight/2))+'px; left: 50%; margin: -25px 0 0 -150px; display: block;');
		body.insertBefore(node, body.firstChild);

		var nodeText = document.createTextNode (this.messages.loading);
		//nodeText.setAttribute ('class', '');
		//nodeText.setAttribute ('style', 'background-image: -webkit-gradient(linear, 0% 0%, 0% 100%, color-stop(0%, #7fb6e7), color-stop(2%, #2986d6), color-stop(100%, #1d5e96)); -webkit-transition: width linear 0.1s; height: 20px; width: 0; display: "block";');
		node.appendChild (nodeText);
		
		this.nodeText = nodeText;
		
		var nodeProgress = document.createElement ('div');
		nodeProgress.setAttribute ('class', '');
		nodeProgress.setAttribute ('style', 'background: -moz-linear-gradient(top,  #2986d6,  #1d5e96); background: -webkit-gradient(linear, 0% 0%, 0% 100%, color-stop(0%, #7fb6e7), color-stop(2%, #2986d6), color-stop(100%, #1d5e96)); -moz-transition: width linear 0.3s; -webkit-transition: width linear 0.3s; height: 8px; border-radius: 5px; width: 0; display: block;');
		node.appendChild (nodeProgress);
		
		node.style.display = 'none';
		node.style.display = 'block';

		body.scrollTop = body.scrollHeight;
		body.style.width  = window.innerWidth + 'px';
		body.style.height = window.innerHeight + 'px';

		// nodeProgress.style.width = '1px';
		this.containerNode = node;
		this.progressBarNode = nodeProgress;
		
		this.scrollChecker = setInterval (function (){
			//console.log ('pageYOffset: ' + window.pageYOffset);
			if (window.pageYOffset > 0) {
				self.onReflow();
			}
		}, 50);
	}
	
	this.update = function (progress) {
		this.progressBarNode.style.width = ~~ (progress * 100) + '%';
		
		if (progress == 1) {
			this.containerNode.firstChild.textContent = this.messages.rendering;
		}
	}
	
	this.onReflow = function () {
		if (Math.floor(window.innerHeight/2) + window.pageYOffset != self.containerNode.offsetTop){
			this.containerNode.style.top  = Math.floor(window.innerHeight/2) + window.pageYOffset + 'px'
			this.containerNode.style.left = Math.floor(window.innerWidth/2)  + window.pageXOffset + 'px'
		}
		//console.log ('iH: ' + Math.floor(window.innerHeight/2) + ' pageYOffset: ' + window.pageYOffset);
		//console.log ('offsetTop: ' + self.containerNode.offsetTop);

	}
	
	this.hide = function () {
		this.containerNode.style.opacity = 0;
		this.containerNode.addEventListener ('webkitTransitionEnd', this.afterHide, false);
		//clearInterval(this.scrollChecker);
	};
	
	this.afterHide = function () {
		clearInterval(this.scrollChecker);
	}


}

