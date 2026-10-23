/* lite-boot: 他のcanvas(波形など)の重い描画を空っぽにして、iPhoneのSafariが落ちないようにする */
(function(){
  'use strict';
  var orig=HTMLCanvasElement.prototype.getContext;
  var stub=new Proxy(function(){},{
    get:function(t,k){
      if(k==='canvas')return document.createElement('canvas');
      if(k==='measureText')return function(){return{width:0}};
      return stub;
    },
    set:function(){return true},
    apply:function(){return stub}
  });
  HTMLCanvasElement.prototype.getContext=function(type){
    if(this.id==='holo')return orig.apply(this,arguments);
    return stub;
  };
})();
