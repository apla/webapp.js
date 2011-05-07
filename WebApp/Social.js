WebApp.Social = function (providers, loader) {
	
	this.providers = {};

	for (var providerClass in providers) {
		// TODO: move to events
		this.providers[providerClass] = new WebApp.Social.Provider[providerClass] (providers[providerClass], loader);
		
	}
	
	this.render = function (renderConfig) {
		for (var providerClass in this.providers) {
			var provider = this.providers[providerClass];
			provider.enqueueRender (renderConfig);
		}
		
	}
	
//	this.head = document.getElementsByTagName('head')[0];
//	this.container = document.getElementById(config.container);
//	this.sitename = config.sitename;
//	this.title = config.title;
//	this.description = config.description;
//	this.url = document.location.href;
//	this.via = config.via || undefined;
//	this.VKapiId = config.VKapiId || undefined;
//	this.FBappId = config.FBappId || undefined;	
//	this.colorscheme = config.colorscheme || undefined;

}

WebApp.Social.Provider = function (config, loader) {
	
	console.log (this);
	
	// activity tracking (like, google analytics events)
	// counter render
	
	this.ready = false;
	
	// if canRender and canTrace properties undefined,
	// then assign that property to the true
	for (var k in {canRender: 0, canTrack: 0})
		this[k] === void(0) && (this[k] = true);
	
	// same for containers
	this.renderQueue === void(0) && (this.renderQueue = {});

	// same for tracking
	this.trackingQueue === void(0) && (this.trackingQueue = []);
	
	this.parent = arguments.callee;
	
	this.enqueueRender = function (renderConfig) {
		if (!this.canRender) return;
		
		if (!renderConfig.to) {
			console.error ("you must define container for rendering");
			return;
		}
		
		// one widget for one container
		this.renderQueue[renderConfig.to] = renderConfig;
		
		if (this.ready)
			this.renderAll();
	}
	
	this.renderAll = function () {
		for (var selector in this.renderQueue) {
			var node = document.querySelector (selector);
			this.render (node, this.renderQueue[selector]);
		}
	}
	
	this._init = function () {
		this.ready = true;
		this.init ();
		this.renderAll ();

	}

	this.prepare = function () {
		for (var res in this.res) {
			if (this.res[res].mustProduce == this.jsClass) {
				this.res[res].cb      = this._init;
				this.res[res].cbScope = this;
			}
		}
		loader.enqueueResources (this.res);
	}
	
}

WebApp.Social.Provider.vkontakte = function (config, loader) {

	this.jsClass = 'VK';
	
	this.config = config;
	
	WebApp.Social.Provider.apply (this, arguments);

	this.init = function () {
		
		// Init Vkontakte application
		try {
			VK.init({
				apiId: this.config.VKapiId,
				onlyWidgets: true
			});
		}
		catch(ex){
			console.log(ex);
		}
	}

	this.res = {
		'http://userapi.com/js/api/openapi.js?17' : {
			require:     null,
			type:        'js',
			mustProduce: this.jsClass
		},
	};
	
	this.prepare ();
	
	this.render = function (el, config) {
	

		// Create vkontakte button
		var button = MakeEl ('div', {id: 'vk-like'});
		
		// Add vkontakte button to container
		el.appendChild(button);
		
		// Load Vkontakte button
		try {
			VK.Widgets.Like('vk-like', {
				type: 'button',
				pageTitle: this.title,
				pageUrl: this.url,
				pageDescription: this.description,
				verb: 1
			});
		}
		catch(ex){
			
		}

	}
}

WebApp.Social.Provider.twitter = function (config, loader) {

	this.jsClass = 'twttr';
	
	this.config = config;
	
	WebApp.Social.Provider.apply (this, arguments);

	this.init = function () {
		
		try {
		// ???
		} catch (ex) {
		// ???
		}
	}
	
	this.res = {
		'http://platform.twitter.com/widgets.js': null
	};
	
//	this.prepare ();
	
	this.render = function (el) {
	
		console.log('twitter');
		
		// Create tweeter button
		var buttonLink = 'http://twitter.com/share?count=horizontal&lang=en&text=&url=&via=';
		var button = MakeEl ('a', {
			href: buttonLink,
			'class': 'twitter-share-button',
			id: 'twitter-share-button'
		}, 'Tweet');
		
		
		// Add twitter button to container
		this.container.appendChild(button);
		
		
		//var tweet_button = new twttr.TweetButton(document.getElementById('twitter-share-button'));
		//tweet_button.render();
	};

}

WebApp.Social.Provider.facebook = function (config, loader) {

	this.jsClass = 'FB';
	
	var proto = document.location.protocol;
	var fbAPI = (proto.match (/^http/) ? proto : 'http:') + '//connect.facebook.net/ru_RU/all.js';
	
	this.res = {};
	this.res[fbAPI] = null;

	WebApp.Social.Provider.apply (this, arguments);

	
	this.render = function (el) {
	
		var fbWidth = '660';
		
		
		// Create meta tags
		var title = MakeEl ('meta', {'og:title': this.title});
		
		var sitename = MakeEl ('meta', {'site_name': this.sitename});
		
		// TODO
		var description = MakeEl ('meta', {'site_name': this.description});
		
		// Add meta tags to head
		this.head.appendChild(title);
		this.head.appendChild(sitename);	
		this.head.appendChild(description);
		
		
		// Create elements 
		var root = MakeEl ('div', {'id': 'fb-root'});
		
		
		var wrapper = MakeEl ('div', {
			'class': 'fb_like_button_container btn_fb',
			'xmlns:og': 'http://opengraphprotocol.org/schema/',
			'xmlns:fb': 'http://www.facebook.com/2008/fbml'
		});
		
		
		var button = MakeEl ('fb:like', {
			'href': this.url,
			'show_faces': 'false',
			'width': fbWidth,
			'action': 'recommend',
			'class': 'fb_like_button2'
		});
		
		if(this.colorscheme){
			button.setAttribute('colorscheme', this.colorscheme);	
		}
		
		
		// Add button to container
		wrapper.appendChild(button);
		this.container.appendChild(root);	
		this.container.appendChild(wrapper);
		
		
		// Load button
		
		window.fbAsyncInit = function() {
			FB.init({
				appId  : this.FBappId,
				status : true, // check login status
				cookie : true, // enable cookies to allow the server to access the session
				xfbml  : true  // parse XFBML
			});
		};

	};

}


WebApp.Social.prototype.loadResources = function (callback) {
	var resources = {
		
		'http://stg.odnoklassniki.ru/share/odkl_share.js?3' : {require: null, type: 'js'},
		'http://stg.odnoklassniki.ru/share/odkl_share.css?3' : {require: null, type: 'css'}
	};
	var loader = WebApp.Loader.instance;
	loader.enqueueResources (resources);
//	loader.when ('VK', function () {
//		this.provi
//	});
}




WebApp.Social.prototype.myworld = function(){
	
	console.log('myworld');
	

	// Create Meta tags	
	var meta = document.createElement('meta');
	meta.setAttribute('name', 'mrc__share_title');
	meta.setAttribute('content', this.title);	

	
	// Add script tag to meta
	this.head.appendChild(meta);		
	
	
	// Create script tag
	this.loadScript('/js/mailru/loader.js');


	// Create button
	var button = document.createElement('a');
	button.setAttribute('target', '_blank');
	button.setAttribute('class', 'mrc__plugin_like_button');
	button.setAttribute('href', 'http://connect.mail.ru/share');
	button.setAttribute('rel', "{'type' : 'button', 'width' : '145'}");
	button.innerHTML = 'Рекомендую';


	// Add twitter button to container
	this.container.appendChild(button);

	
}




WebApp.Social.prototype.odnoklasniki = function(){
	
	// Odnoklasniki init
	/*
	if (window.addEventListener) //DOM method for binding an event
		window.addEventListener("load", ODKL.init, false);
	else if (window.attachEvent) //IE exclusive method for binding an event
		window.attachEvent("onload", ODKL.init);
	else if (document.getElementById) //support older modern browsers
		window.onload=ODKL.init;
	*/


	// Create wrapper	
	var wrapper = document.createElement('div');


	// Create button
	var button = document.createElement('a');
	button.setAttribute('class','odkl-share-oc');
	button.setAttribute('href', this.url );
	button.setAttribute('onclick', 'ODKL.Share(this);return false;' );


	// Create button counter
	var count = document.createElement('span');
	count.innerText = '0';


	// Build button and add to container
	button.appendChild(count);
	wrapper.appendChild(button);
	this.container.appendChild(wrapper);
	
	
}

