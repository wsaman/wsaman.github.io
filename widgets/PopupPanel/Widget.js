///////////////////////////////////////////////////////////////////////////
// Popup Panel Widget - Author: Robert Scheitlin
///////////////////////////////////////////////////////////////////////////
/*global define*/
define([
  'dojo/_base/declare',
  'dijit/_WidgetsInTemplateMixin',
  'jimu/BaseWidget',
  'jimu/dijit/Message',
  'esri/domUtils',
  'esri/dijit/Popup',
  'dojo/on',
  'dojo/topic',
  'dojo/query',
  'dojo/_base/html',
  'dojo/dom-class',
  'dojo/dom-construct',
  'dojo/_base/lang',
  'jimu/WidgetManager',
  'jimu/PanelManager',
  'jimu/MapManager',
  'dojo/i18n!esri/nls/jsapi',
  'jimu/FeatureActionManager',
  'jimu/dijit/FeatureActionPopupMenu',
  'jimu/utils',
  'dojo/_base/array',
  'dijit/layout/ContentPane'
],
  function (
    declare,
    _WidgetsInTemplateMixin,
    BaseWidget,
    Message,
    domUtils,
    Popup,
    on,
    topic,
    query,
    html,
    domClass,
    domConstruct,
    lang,
    WidgetManager,
    PanelManager,
    MapManager,
    esriBundle,
    FeatureActionManager,
    PopupMenu,
    jimuUtils,
    array,
    ContentPane
  ) {
    return declare([BaseWidget, _WidgetsInTemplateMixin], {

      baseClass: 'widget-popuppanel',
      name: 'PopupPanel',
      label: 'Popup Panel',
      popup: null,
      zt: null,
      clearSel: null,
      popupMenu: null,
      featureActionManager: null,
      inPanel: null,
      popupContent: null,

      postCreate: function () {
        this.inherited(arguments);
        this.popupMenu = PopupMenu.getInstance();
        this.featureActionManager = FeatureActionManager.getInstance();

        if(this.config.hasOwnProperty("actionMenuPos") && this.config.actionMenuPos === "top"){
          //top
          this.popupContent = new ContentPane({
            id: 'popupContent',
            content: '',
            region: "center",
            style: 'margin-top: 22px;'
          }).placeAt(this.divBottom).startup();
        } else {
          //bottom
          this.popupContent = new ContentPane({
            id: 'popupContent',
            content: '',
            region: "center"
          }).placeAt(this.divTop).startup();
        }
        this.popupContent = dijit.byId("popupContent");
        domUtils.hide(this.actionsPaneDiv);
        this.own(on(this.domNode, 'mousedown', lang.hitch(this, function (event) {
          event.stopPropagation();
          if (event.altKey) {
            var msgStr = this.nls.widgetverstr + ': ' + this.manifest.version;
            msgStr += '\n' + this.nls.wabversionmsg + ': ' + this.manifest.wabVersion;
            msgStr += '\n' + this.manifest.description;
            new Message({
              titleLabel: this.nls.widgetversion,
              message: msgStr
            });
          }
        })));

        this.popup = this.map.infoWindow;

        this.zt = domConstruct.toDom('<a title="Zoom" to="" class="action zoomTo" href="javascript:void(0);"><span>' +
                                    esriBundle.widgets.popup.NLS_zoomTo + '</span></a>');
        domConstruct.place(this.zt, this.actionsListDiv);

        this.clearSel = domConstruct.toDom('<a title="' + this.nls.clearseltip +'" to="" class="action clearSel" href="javascript:void(0);"><span>' + this.nls.clearsel + '</span></a>');
        domConstruct.place(this.clearSel, this.actionsListDiv);
        topic.subscribe("widgetsActionsRegistered", lang.hitch(this, this._onWidgetsActionsRegistered));
        this._createPopupMenuButton();
        this.setEvtHandlers();
        this.onWindowResize();
      },

      _onWidgetsActionsRegistered: function(){
        if(this.selectedFeature){
          this._initPopupMenu();
        }
      },

      onWindowResize: function(){
        var mapMan = MapManager.getInstance();
        if(mapMan.isMobileInfoWindow){
          this.map.setInfoWindow(mapMan._mapInfoWindow);
          this.popup = this.map.infoWindow;
          this.setEvtHandlers();
          mapMan.isMobileInfoWindow = false;
        }
      },

      _initPopupMenu: function(){
        this.featureActionManager.getSupportedActions(this.selectedFeature).then(lang.hitch(this, function(actions){
          if (this.config.allowExport === false) {
            actions = array.filter(actions, function(action) {
              return action.name.indexOf('Export') !== 0 && action.name !== 'SaveToMyContent';
            });
          }

          var popupActions = actions.filter(lang.hitch(this, function(action){
            return ['ZoomTo', 'ShowPopup', 'Flash'].indexOf(action.name) < 0 ;
          }));

          if(popupActions.length === 0){
            html.addClass(this.popupMenuButton, 'disabled');
          }else{
            html.removeClass(this.popupMenuButton, 'disabled');
          }
          var menuActions = popupActions.map(lang.hitch(this, function(action){
            action.data = jimuUtils.toFeatureSet(this.selectedFeature);
            return action;
          }));
          this.popupMenu.setActions(menuActions);
        }));
      },

      _createPopupMenuButton: function(){
        this.popupMenuButton = html.create('span', {
          'class': 'popup-menu-button'
        }, query(".actionList", this.domNode)[0]);

        on(this.popupMenuButton, 'click', lang.hitch(this, this._onPopupMenuButtonClick));
      },

      _onPopupMenuButtonClick: function(evt){
        var position = html.position(evt.target);
        this.popupMenu.show(position);
      },

      setEvtHandlers: function(){
        this.own(on(this.popup, "selection-change", lang.hitch(this, function (evt) {
          this.selectedFeature = evt.target.getSelectedFeature();
          if(this.selectedFeature){
            this._initPopupMenu();
          }
          this.displayPopupContent(this.popup.getSelectedFeature());
        })));

        this.own(on(this.popup, "clear-features", lang.hitch(this, function () {
          if(this.instructions){
            domUtils.show(this.instructions);
            this.instructions.innerHTML = this.nls.selectfeatures;
          }
          if(this.popupContent){
            this.popupContent.set("content", "");
          }
          domUtils.hide(this.pager);
        })));

        this.own(on(this.popup, "set-features", lang.hitch(this, function(){
          if(!this.popup.features){
            domUtils.hide(this.pager);
            domUtils.show(this.instructions);
            domUtils.hide(this.actionsPaneDiv);
            return;
          }
          if(this.popup.features.length === 0){
            domUtils.show(this.instructions);
            domUtils.hide(this.actionsPaneDiv);
          }else{
            domUtils.hide(this.instructions);
            domUtils.show(this.actionsPaneDiv);
          }
          this.displayPopupContent(this.popup.getSelectedFeature());
          this.featureCount.innerHTML = "(1 of " + this.popup.features.length + ")";

          //enable navigation if more than one feature is selected
          if(this.popup.features.length > 1){
            domUtils.show(this.pager);
            domClass.add(this.previous, "hidden");
            domClass.remove(this.next, "hidden");
            domClass.remove(this.clearSel, "hidden");
          }else if (this.popup.features.length === 1){
            domUtils.show(this.pager);
            domClass.add(this.previous, "hidden");
            domClass.add(this.next, "hidden");
            domClass.add(this.clearSel, "hidden");
          }else{
            domUtils.hide(this.pager);
            domClass.add(this.clearSel, "hidden");
          }
        })));

        this.own(on(this.previous, "click", lang.hitch(this, function(){this.selectPrevious();})));
        this.own(on(this.next, "click", lang.hitch(this, function(){this.selectNext();})));
        this.own(on(this.btnClear, "click", lang.hitch(this, this.clearResults)));
        this.own(on(this.zt, "click", lang.hitch(this, this.zoomToClicked)));
        this.own(on(this.clearSel, "click", lang.hitch(this, this.clearSelResults)));
        this.own(on(window, 'resize', lang.hitch(this, this.onWindowResize)));
      },

      clearSelResults: function(){
        var curFeats = this.popup.features;
        curFeats.splice(this.popup.selectedIndex, 1);
        this.popup.setFeatures(curFeats);
      },

      zoomToClicked: function(e) {
        this.popup._zoomToFeature(e);
      },

      clearResults: function() {
        if(this.config.closeOnClear){
          this.closeWidget();
        }
        if(this.instructions){
          domUtils.show(this.instructions);
          this.instructions.innerHTML = this.nls.selectfeatures;
        }
        if(this.popupContent){
          this.popupContent.set("content", "");
        }
        domUtils.hide(this.pager);
        domUtils.hide(this.actionsPaneDiv);
        this.popup.clearFeatures();
      },

      startup: function () {
        this.inherited(arguments);
        this.inPanel = this.getPanel();
        this.displayPopupContent(this.popup.getSelectedFeature());
        if(this.config.closeAtStart){
          if(!this.popup.getSelectedFeature()){
            setTimeout(lang.hitch(this, function(){
              this.closeWidget();
            }), 300);
          }
        }
      },

      closeWidget: function() {
        if(this.inPanel){
          //console.info(this.inPanel);
          if(this.appConfig.theme.name === 'JewelryBoxTheme'){
            PanelManager.getInstance().minimizePanel(this.inPanel);
          }else if(this.appConfig.theme.name === 'TabTheme') {
            var sbc = WidgetManager.getInstance().getWidgetsByName("SidebarController")[0];
            sbc._resizeToMin();
          }else{
            PanelManager.getInstance().closePanel(this.inPanel);
          }
        }else{
          WidgetManager.getInstance().closeWidget(this);
        }
      },

      onOpen: function () {
        var mapMan = MapManager.getInstance();
        if(mapMan.isMobileInfoWindow){
          this.map.setInfoWindow(mapMan._mapInfoWindow);
          mapMan.isMobileInfoWindow = false;
        }
        this.map.infoWindow.set("popupWindow", false);
      },

      onDestroy: function () {
        var mapMan = MapManager.getInstance();
        mapMan.resetInfoWindow(false);
        if(!mapMan.isMobileInfoWindow){
          this.map.infoWindow.set("popupWindow", true);
        }
      },

      displayPopupContent: function (feature) {
        if (feature) {
          if(this.inPanel){
            if(this.appConfig.theme.name === 'JewelryBoxTheme'){
              PanelManager.getInstance().maximizePanel(this.inPanel);
            }else if(this.appConfig.theme.name === 'TabTheme') {
              var sbc = WidgetManager.getInstance().getWidgetsByName("SidebarController")[0];
              sbc._resizeToMax();
            }else{
              PanelManager.getInstance().normalizePanel(this.inPanel);
            }
          }else{
            WidgetManager.getInstance().triggerWidgetOpen(this.id);
          }
          var content = feature.getContent();
          if(this.popupContent){
            this.popupContent.set("content", content);
          }
          domUtils.show(this.actionsPaneDiv);
        }else{
          domUtils.hide(this.pager);
          domUtils.show(this.instructions);
          domUtils.hide(this.actionsPaneDiv);
        }
      },

      selectPrevious: function () {
        this.popup.selectPrevious();
        this.featureCount.innerHTML = "(" + (this.popup.selectedIndex + 1) + " of " + this.popup.features.length + ")";
        if((this.popup.selectedIndex + 1) < this.popup.features.length){
          domClass.remove(this.next, "hidden");
        }
        if(this.popup.selectedIndex === 0){
          domClass.add(this.previous, "hidden");
        }
      },

      selectNext: function () {
        domClass.remove(this.previous, "hidden");
        this.popup.selectNext();
        this.featureCount.innerHTML = "(" + (this.popup.selectedIndex + 1) + " of " + this.popup.features.length + ")";
        if((this.popup.selectedIndex + 1) === this.popup.features.length){
          domClass.add(this.next, "hidden");
        }
      }

    });
  });
