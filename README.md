WebApp.js
=========

we use this library for many things -- loading dependent javascript and css,
inserting social buttons asynchronously and many more...

classes
-------

### WebApp.Loader

this class load page resources, optionally displaying progress bar

synopsis:

`index.html`:

	...
	<script	type="text/javascript" src="/a/j/WebApp.js"> </script>
	<script type="text/javascript" src="/a/j/index.js"> </script>
	...

`index.js`:

	UI = {
		init : function(loader) {
			// init stuff
			// ...
			// hide progress bar
			loader.done ();
		}
	};

	web_app = new WebApp.Loader ({
		assets: {
			'/a/css/Ext.ux.TouchGridPanel.css' : null,
			'/a/sencha-touch-1.0.1a/resources/css/sencha-touch.css' : null,
			'/a/sencha-touch-1.0.1a/sencha-touch.js' : null,
			'/a/j/WebAppEntity.js' : 'Ext',
			'/a/j/iOSUI.js': 'WebApp.Entity'
		},
		readyCallback: function (loader) {
		
			Ext.setup({
				onReady: function() {
					UI.init(loader);
				}
			});

		}
	});

after DOMContentLoaded event fired, WebApp.Loader begin to load resources. if javascript
resource require javascript class to work, then WebApp.Loader wait until class available.

### WebApp.Social

social things page integration, like "like" counters, "like" buttons and so on

installation
------------

preferred way to install library is adding by submodule `git submodule`


additional
----------


