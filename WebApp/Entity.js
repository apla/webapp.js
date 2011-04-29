/**
 * WebApp.Entity
 * @extends Ext.data.Store
 * @cfg {String} url This will be a url of a location to load the BookStore
 * This is a specialized Store which maintains books.
 * It already knows about Amazon's XML definition and will expose the following
 * Record defintion:
 *  - Author
 *  - Manufacturer
 *  - ProductGroup
 *  - DetailPageURL
 */
 
// entity contains proxy for accessing data, record definition,
// model for using single record and store for accessing record list

//Ext.require([
//    'Ext.grid.*',
//    'Ext.data.*',
//    'Ext.panel.*'
//]);

Ext.ns("WebApp");

// copied from restproxy
var proxyInit = {
    
    appendId: true,
    actionMethods: {
        create: 'POST', read: 'GET', update: 'PUT', destroy: 'DELETE'
	},
    api: {
        create: 'create', read: 'read', update: 'update', destroy: 'destroy'
    },
    
    buildUrl: function(request) {
		// console.log (request);
        var records = request.operation.records || [],
            record  = records[0],
            format  = this.format,
            url     = request.url || this.url;
        
        if (this.appendId && (record || request.operation.id)) {
            if (!url.match(/\/$/)) {
                url += '/';
            }
            
            url += (record ? record.getId() : request.operation.id);
        }
        
        if (format) {
            if (!url.match(/\.$/)) {
                url += '.';
            }
            
            url += format;
        }
        
        request.url = url;
		
		// HACK: every filter has own query string param
		if (request.params[this.filterParam]) {
			for (var k in request.params[this.filterParam]) {
				request.params[k] = request.params[this.filterParam][k];
			}
			delete request.params[this.filterParam];
		}
        
        return WebApp.AjaxProxy.superclass.buildUrl.apply(this, arguments);
    },
	encodeFilters: function(filters) {
        var filterList = {},
            length = filters.length,
            i;
        
        for (i = 0; i < length; i++) {
			// console.log (Ext.encode(filters[i].property), Ext.encode(filters[i].value));
            filterList["filter." + Ext.encode(filters[i].property).replace(/^"|"$/g, '')]
				= Ext.encode(filters[i].value).replace(/^"|"$/g, '');
        }
        
		// console.log (filterList);
		
        return filterList;
    }
};

// console.log (Ext.getVersion('core').getMajor());

modernExt = 0;

if (Ext.getVersion && Ext.getVersion('core').getMajor() >= 4) {
	modernExt = 1;
}

if (modernExt) {
	
	proxyInit.extend = 'Ext.data.AjaxProxy';
    proxyInit.alias  = 'proxy.webappajax';
	
	Ext.define ('WebApp.AjaxProxy', proxyInit);
	
} else {
	WebApp.AjaxProxy = Ext.extend(Ext.data.AjaxProxy, proxyInit);
	
	Ext.data.ProxyMgr.registerType('webappajax', WebApp.AjaxProxy);
	
}



// Ext.define ('WebApp.Entity', { // TODO: use within extjs4
WebApp.Entity = Ext.extend (Ext.util.Observable, {
	//extend: 'Ext.data.Store',
	modelPrefix: 'WebApp.Entity.',
	storeSuffix: '.Collection',
	_undefined_key : function (key) {
		return "please define '" + key + "' in "+Ext.getClassName (this)+" constructor";
	},
	modelFields: function () {
		// extract fields for model
		var allowedKeys = [
			'allowBlank', 'convert', 'dateFormat', 'defaultValue',
			'mapping', 'name', 'sortDir', 'sortType', 'type', 'useNull'
		];
		return this._filterFields ('name', allowedKeys);
	},
	gridColumns: function () {
		// extract fields for model
		var allowedKeys = [
			['name', 'mapping'], // name maps to the mapping
			'header', 'flex', 'renderer'
		];
		return this._filterFields ('header', allowedKeys);
	},
	formFields: function () {
		var allowedKeys = [
			'xtype', 'label', 'useClearIcon', 'autoCapitalize', 'disabled', 'placeHolder'
		];
		return this._filterFields ('label', allowedKeys);
	},
	_filterFields: function (required, filter) {
		var result = [];
		for (j = 0; j < this.fields.length; j++) {
			var field = null;
			if (!this.fields[j][required])
				continue;
			for (var k in this.fields[j]) {
				for (i = 0; i < filter.length; i++) {
					var key;
					if (k == filter[i]) {
						key = k
					} else if (filter[i] instanceof Array && k == filter[i][0]) {
						key = filter[i][1]
					} else {
						continue
					}
					
					if (field == null) {
						field = {};
						result.push (field);
					}
					
					field[key] = this.fields[j][k];
				}
			}
		}
		return result;
	},
	constructor: function (config) {
		
		this.name   = config.named;
		this.fields = config.withFields;
		
		if (!this.name) {
			console.error (this._undefined_key ("named"));
			return;
		}
		if (!this.fields) {
			console.error (this._undefined_key ("withFields"));
			return;
		}
		
		// TODO: model's idProperty
		// TODO: store's pageSize
		
		var modelName = this.modelPrefix + this.name;
		var storeName = modelName + this.storeSuffix;
		
		this.model = Ext.ModelMgr.getModel(modelName);
		if (!this.model) {
			// TODO: make sure model has WebApp.Entity.{this.name} class name
			this.model = Ext.regModel (modelName, {
				fields: this.modelFields(),
				idProperty: config.identifiedBy || 'id'
			});
			
		}

		// model must contain proxy for accessing data and fields to
		// describe what data can be accessed
		this.proxy = this.model.getProxy();
		if (!this.proxy) {
			// create reader, use web-app defaults
			this.reader = config.withReader || {
				type : 'json',
				root : 'list.items',
				successProperty : 'list.success',
				versionProperty : 'list.version',
				totalProperty   : 'list.total_count'
			};
			
			// create proxy, use web-app defaults
			var proxyConfig = config.withProxy || {
				type: 'webappajax',
				url : config.locatedOn,
				reader: this.reader
			};
			
			if (modernExt) {
				this.proxy = Ext.createByAlias("proxy." + proxyConfig.type, proxyConfig);
			} else {
				this.proxy = Ext.data.ProxyMgr.create (proxyConfig);
				
			}
			this.proxy.setModel(this.model);
			this.model.proxy = this.proxy;
			
		}
		
		// store contains model, filtering and sorting parameters
		var storeManager = Ext.StoreMgr ? Ext.StoreMgr : Ext.data.StoreMgr;
		
		this.store = storeManager.lookup(storeName);
		if (!this.store) {
			this.store = new Ext.data.Store({
				remoteSort: true,
				remoteFilter: true,
				model: modelName,
				storeId: storeName
			});
		}
		
		return this;
		
//		var collection = Ext.ns ('WebApp.Entity.'+this.name+'.Collection');
//		
//		collection = Ext.extend ('Ext.data.Store', {
//			constructor: function(config) {
//				config = config || {};
//
//				config.model = this.name;
//				config.proxy = this.proxy;
//
//				// call the superclass's constructor
//				collection.superclass.constructor.call(this, config);
//			}
//		});
		
		//this.initConfig(config); return this;
	}
	// now we can define model and store
	
});


/*
    Author       : Mitchell Simoens
    Site         : http://simoens.org/Sencha-Projects/demos/
    Contact Info : mitchellsimoens@gmail.com
    Purpose      : Creation of a grid for Sencha Touch

	License      : GPL v3 (http://www.gnu.org/licenses/gpl.html)
    Warranty     : none
    Price        : free
    Version      : 2.0b1
    Date         : 1/31/2011
*/

/*
 * Because of limitation of the current WebKit implementation of CSS3 column layout,
 * I have decided to revert back to using table.
 */

Ext.ns("Ext.ux");

Ext.ux.TouchGridPanel = Ext.extend(Ext.Panel, {
	layout        : "fit",

	multiSelect   : false,

	initComponent : function() {
		this.dataview = this.buildDataView();
		this.items = this.dataview;

		if (!Ext.isArray(this.dockedItems)) {
			this.dockedItems = [];
		}

		this.header = new Ext.Component(this.buildHeader());

		this.dockedItems.push(this.header);

		Ext.ux.TouchGridPanel.superclass.initComponent.call(this);
	},

	buildHeader   : function() {
		var colModel  = this.colModel,
			colNum    = this.getColNum(false),
			cellWidth = 100/colNum,
			colTpl    = '<table class="x-grid-header">';

		colTpl += '    <tr>';
		for (var i = 0; i < colModel.length; i++) {
			var col  = colModel[i],
				flex = col.flex || 1,
				cls  = "";

			var width = flex * cellWidth;

			if (col.hidden) {
				cls += "x-grid-col-hidden";
			}

			colTpl += '<td width="' + width + '%" class="x-grid-cell x-grid-hd-cell x-grid-col-' + col.mapping + ' ' + cls + '" mapping="' + col.mapping + '">' + col.header + '</td>';
		}
		colTpl += '    </tr>';
		colTpl += '</table>';

		return {
			dock  : "top",
			html  : colTpl,
			listeners: {
				scope: this,
				afterrender: this.initHeaderEvents
			}
		};
	},

	initHeaderEvents: function(cmp) {
		var el = cmp.getEl();
		el.on("click", this.handleHeaderClick, this);
	},

	handleHeaderClick: function(e, t) {
		e.stopEvent();

		var el = Ext.get(t);
		var mapping = el.getAttribute("mapping");

		if (typeof mapping === "string") {
			this.store.sort(mapping);
			el.set({
				sort: this.store.sortToggle[mapping]
			});
		}
	},

	buildDataView : function() {
		var colModel  = this.colModel,
			colNum    = this.getColNum(false),
			colTpl    = '<tr class="x-grid-row">',
			cellWidth = 100/colNum;

		for (var i = 0; i < colModel.length; i++) {
			var col   = colModel[i],
				flex  = col.flex || 1,
				width = flex * cellWidth,
				style = (i === colModel.length - 1) ? "padding-right: 10px;" : "",
				cls   = col.cls || "";

			style += col.style || "";

			if (col.hidden) {
				cls += "x-grid-col-hidden";
			}

			colTpl += '<td width="' + width + '%" class="x-grid-cell x-grid-col-' + col.mapping + ' ' + cls + '" style="' + style + '" mapping="' + col.mapping + '">{' + col.mapping + '}</td>';
		}
		colTpl += '</tr>';

		return new Ext.DataView({
			store        : this.store,
			itemSelector : "tr.x-grid-row",
			simpleSelect : this.multiSelect,
			tpl          : new Ext.XTemplate(
				'<table style="width: 100%;">',
					'<tpl for=".">',
						colTpl,
					'</tpl>',
				'</table>'
			),
			bubbleEvents : [
				"beforeselect",
				"containertap",
				"itemdoubletap",
				"itemswipe",
				"itemtap",
				"selectionchange"
			]
		});
	},

	// hidden = true to count all columns
	getColNum     : function(hidden) {
		var colModel = this.colModel,
			colNum   = 0;

		for (var i = 0; i < colModel.length; i++) {
			var col = colModel[i];
			if (!hidden && typeof col.header !== "string") { continue; }
			if (!col.hidden) {
				colNum += col.flex || 1;
			}
		}

		return colNum;
	},

	getMappings: function() {
		var mappings = {},
			colModel = this.colModel;
		for (var i = 0; i < colModel.length; i++) {
			mappings[colModel[i].mapping] = i
		}

		return mappings;
	},

	toggleColumn: function(index) {
		if (typeof index === "string") {
			var mappings = this.getMappings();
			index = mappings[index];
		}
		var el      = this.getEl(),
			mapping = this.colModel[index].mapping,
			cells   = el.query("td.x-grid-col-"+mapping);

		for (var c = 0; c < cells.length; c++) {
			var cellEl = Ext.get(cells[c]);
			if (cellEl.hasCls("x-grid-col-hidden")) {
				cellEl.removeCls("x-grid-col-hidden");
				this.colModel[index].hidden = false;
			} else {
				cellEl.addCls("x-grid-col-hidden");
				this.colModel[index].hidden = true;
			}
		}

		this.updateWidths();
	},

	updateWidths: function() {
		var el          = this.getEl(),
			headerWidth = this.header.getEl().getWidth(),
			colModel    = this.colModel,
			cells       = el.query("td.x-grid-cell"),
			colNum      = this.getColNum(false),
			cellWidth   = 100 / colNum;

		var mappings = this.getMappings();

		for (var c = 0; c < cells.length; c++) {
			var cellEl  = Ext.get(cells[c]),
				mapping = cellEl.getAttribute("mapping"),
				col     = colModel[mappings[mapping]],
				flex    = col.flex || 1,
				width   = flex * cellWidth / 100 * headerWidth;
			cellEl.setWidth(width);
		}
	}
});

Ext.reg("touchgridpanel", Ext.ux.TouchGridPanel);