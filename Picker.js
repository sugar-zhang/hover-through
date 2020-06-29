(function () {
  var randColor = function () {
    return "#" + Math.random().toString(16).substr(-6);
  };
  var uniColor = function () {
    var t = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
      e = 100,
      n = 0;
    while (1) {
      var i = randColor();
      if ((n++, !t[i] && "#ffffff" !== i)) return i;
      if (n > e) throw new Error("Could not generate new hit test color.");
    }
  };
  var ctxDraw = function (clipCanvas, clipCtx, imgCanvas, imgCtx, el, color, width, height) {
    var l = el.naturalWidth || el.width,
      c = el.naturalHeight || el.height;
    (imgCanvas.width = width),
      (imgCanvas.height = height),
      (imgCtx.shadowBlur = 2),
      (imgCtx.shadowColor = "black"),
      imgCtx.drawImage(el, 0, 0, l, c, 0, 0, width, height);
    for (var u = imgCtx.getImageData(0, 0, width, height), d = 0; d < u.data.length; d += 4)
      u.data[d + 3] = 0 !== u.data[d + 3] ? 255 : 0;
    imgCtx.putImageData(u, 0, 0),
      (clipCanvas.width = width),
      (clipCanvas.height = height),
      clipCtx.save(),
      clipCtx.drawImage(imgCanvas, 0, 0, width, height),
      (clipCtx.globalCompositeOperation = "source-in"),
      (clipCtx.fillStyle = color),
      clipCtx.fillRect(0, 0, width, height),
      clipCtx.restore();
  };
  var ctxTransform = function (hitCtx, transform, x, y, width, height) {
    if (transform) {
      var a = transform.a,
        s = transform.b,
        l = transform.c,
        c = transform.d,
        u = transform.tx,
        d = transform.ty,
        h = x + width / 2,
        f = y + height / 2;
      hitCtx.save(),
        hitCtx.translate(h, f),
        hitCtx.transform(a, s, l, c, u, d),
        hitCtx.translate(-h, -f);
    }
  };
  var gap = function (rgb, imageData) {
    var i,
      value = 0;
    for (i = 0; i < rgb.length; i++) value += (rgb[i] - imageData[i]) * (rgb[i] - imageData[i]);
    return Math.sqrt(value); // 平方根
  };
  function toArray(t) {
    return se(t) || ae(t) || oe(t) || re();
  }
  function re() {
    throw new TypeError(
      "Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."
    );
  }
  function oe(t, e) {
    if (t) {
      if ("string" === typeof t) return arrayCopy(t, e);
      var n = Object.prototype.toString.call(t).slice(8, -1);
      return (
        "Object" === n && t.constructor && (n = t.constructor.name),
        "Map" === n || "Set" === n
          ? Array.from(n)
          : "Arguments" === n || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)
          ? arrayCopy(t, e)
          : void 0
      );
    }
  }
  function ae(t) {
    if ("undefined" !== typeof Symbol && Symbol.iterator in Object(t)) return Array.from(t);
  }
  function se(t) {
    if (Array.isArray(t)) return arrayCopy(t);
  }
  function arrayCopy(t, e) {
    (null == e || e > t.length) && (e = t.length);
    for (var n = 0, i = new Array(e); n < e; n++) i[n] = t[n];
    return i;
  }

  /*
    容器内图片需加上 crossorigin 字段，防止canvas跨域
    需配合tinycolor使用
    <script src="https://cdn.bootcdn.net/ajax/libs/tinycolor/1.4.1/tinycolor.min.js"></script>
  */
  function Picker(options) {
    this.options = Object.assign({ defaultSize: 1500 }, options);
    this.hitCanvas = document.createElement("canvas");
    this.hitCtx = this.hitCanvas.getContext("2d");
    this.clipCanvas = document.createElement("canvas");
    this.clipCtx = this.clipCanvas.getContext("2d");
    this.imgCanvas = document.createElement("canvas");
    this.imgCtx = this.imgCanvas.getContext("2d");
    this.colorMap = {};
    this.zoom = 1;

    if (this.options.debug) {
      document.body.appendChild(this.hitCanvas);
      document.body.appendChild(this.clipCanvas);
      document.body.appendChild(this.imgCanvas);
    }
  }

  /* 
    容器内任一元素添加、删除、移动、旋转、宽高变化、层级变化时调用
    调用时需防抖，以防止性能过度消耗
    list: 容器内所有元素按格式传入 需按z-index层级升序
    containerWidth, containerHeight: 容器宽高

    [{
      $el: o,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      type: o.tagName === "IMG" ? "image" : "default",
      zIndex: parseFloat(o.style.zIndex || 0),
      transform: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        tx: 0,
        ty: 0,
    }]
  */
  Picker.prototype.update = function (list, containerWidth, containerHeight) {
    list.sort(function (a, b) {
      return a.zIndex - b.zIndex;
    });
    var that = this,
      defaultSize = this.options.defaultSize,
      o = Math.min(defaultSize / containerWidth, defaultSize / containerHeight, 1);
    return (
      // 容器的宽高
      (this.hitCanvas.width = containerWidth * o),
      (this.hitCanvas.height = containerHeight * o),
      (this.colorMap = {}),
      (this.zoom = o),
      // item.transform 默认(1,0,0,1,0,0) rotate transition 等会改变这个值
      list.reduce(function (t, item) {
        return t.then(function () {
          var type = item.type,
            transform = item.transform,
            x = item.x,
            y = item.y,
            width = item.width,
            height = item.height;
          if (!(!width || !height || width < 1 || height < 1)) {
            (x *= o),
              (y *= o),
              (width = Math.max(1, width * o)),
              (height = Math.max(1, height * o));
            var color = uniColor(that.colorMap);
            that.colorMap[color] = item;
            var hitCtx = that.hitCtx,
              clipCanvas = that.clipCanvas,
              clipCtx = that.clipCtx,
              imgCanvas = that.imgCanvas,
              imgCtx = that.imgCtx;
            if ("default" === type)
              return (
                ctxTransform(hitCtx, transform, x, y, width, height),
                (hitCtx.fillStyle = color),
                hitCtx.fillRect(x, y, width, height),
                hitCtx.restore(),
                Promise.resolve()
              );
            if ("image" === type)
              return (
                ctxTransform(hitCtx, transform, x, y, width, height),
                ctxDraw(clipCanvas, clipCtx, imgCanvas, imgCtx, item.$el, color, width, height),
                hitCtx.drawImage(clipCanvas, x, y),
                hitCtx.restore(),
                Promise.resolve()
              );
            if ("svg" === type) {
              var svgHtml = new XMLSerializer().serializeToString(item.$el),
                img = new Image();
              return new Promise(function (resolve) {
                img.onload = function () {
                  ctxTransform(hitCtx, transform, x, y, width, height),
                    ctxDraw(clipCanvas, clipCtx, imgCanvas, imgCtx, img, color, width, height),
                    hitCtx.drawImage(clipCanvas, x, y),
                    hitCtx.restore(),
                    resolve();
                };
                var e = "data:image/svg+xml; charset=utf8, ";
                img.src = e + encodeURIComponent(svgHtml);
              });
            }
          }
        });
      }, Promise.resolve())
    );
  };

  /*
    传入是相对容器的坐标值，如果容器有缩放，需要修正坐标值
  */
  Picker.prototype.pick = function (x, y) {
    var zoom = this.zoom,
      imageData = this.hitCtx.getImageData(x * zoom, y * zoom, 1, 1).data,
      color = tinycolor("rgba(".concat(imageData.toString())).toHexString();
    // 如果该点是透明 返回空
    if (!imageData || 0 === imageData[3]) return null;
    // 如果colorMap中有该点颜色
    if (this.colorMap[color]) return this.colorMap[color];
    var obj = {},
      a = Object.keys(this.colorMap).map(function (key) {
        var rgb = Object.values(tinycolor(key).toRgb()),
          n = gap(rgb, imageData);
        return (obj[n] = key), n;
      });
    // 返回与鼠标像素点色值最接近的颜色的对象
    return (color = obj[Math.min.apply(Math, toArray(a))]), this.colorMap[color] || null;
  };

  window.Picker = Picker;
})();
