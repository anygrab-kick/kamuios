/**
 * 投げ縄選択オーバーレイコンポーネント
 * 3Dグラフとは独立したレイヤーで動作
 */
class LassoOverlay {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      strokeColor: '#818CF8',
      strokeWidth: 3,
      fillOpacity: 0.2,
      fadeOutDuration: 1000,
      minPoints: 3,
      ...options
    };
    
    this.isActive = false;
    this.isDrawing = false;
    this.points = [];
    this.currentPath = null;
    this.animationId = null;
    this.callbacks = {
      onSelectionComplete: null,
      onDrawStart: null,
      onDrawEnd: null
    };
    
    this.init();
  }
  
  init() {
    // オーバーレイコンテナを作成
    this.overlay = document.createElement('div');
    this.overlay.className = 'lasso-overlay-container';
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      pointer-events: none;
      overflow: hidden;
    `;
    
    // SVGキャンバスを作成
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    `;
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    
    // 描画用のグループを作成
    this.drawGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.drawGroup.style.filter = `drop-shadow(0 0 8px ${this.options.strokeColor}80)`;
    this.svg.appendChild(this.drawGroup);
    
    this.overlay.appendChild(this.svg);
    this.container.appendChild(this.overlay);
    
    // イベントリスナーを設定
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // ポインターイベントをバインド
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
    
    // コンテナ全体にイベントリスナーを設定
    this.container.addEventListener('pointerdown', this.handlePointerDown, { capture: true });
    this.container.addEventListener('pointermove', this.handlePointerMove, { capture: true });
    this.container.addEventListener('pointerup', this.handlePointerUp, { capture: true });
    this.container.addEventListener('pointercancel', this.handlePointerCancel, { capture: true });
  }
  
  setActive(active) {
    this.isActive = active;
    this.overlay.style.pointerEvents = active ? 'auto' : 'none';
    
    if (!active) {
      this.cancelDrawing();
      this.clearPaths();
    }
  }
  
  handlePointerDown(event) {
    if (!this.isActive || this.isDrawing) return;
    if (event.button !== 0 || event.isPrimary === false) return;
    
    const point = this.getPointFromEvent(event);
    if (!point) return;
    
    this.isDrawing = true;
    this.points = [point];
    
    // 新しいパスを作成
    this.currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.currentPath.style.fill = this.hexToRgba(this.options.strokeColor, this.options.fillOpacity);
    this.currentPath.style.stroke = this.options.strokeColor;
    this.currentPath.style.strokeWidth = this.options.strokeWidth;
    this.currentPath.style.strokeLinejoin = 'round';
    this.currentPath.style.strokeLinecap = 'round';
    this.drawGroup.appendChild(this.currentPath);
    
    // ポインターをキャプチャ
    try {
      event.target.setPointerCapture(event.pointerId);
    } catch (e) {
      console.warn('Failed to capture pointer:', e);
    }
    
    // 描画開始コールバック
    if (this.callbacks.onDrawStart) {
      this.callbacks.onDrawStart(point);
    }
    
    event.preventDefault();
    event.stopPropagation();
  }
  
  handlePointerMove(event) {
    if (!this.isActive || !this.isDrawing) return;
    
    const point = this.getPointFromEvent(event);
    if (!point) return;
    
    // 最後の点との距離が一定以上の場合のみ追加
    const lastPoint = this.points[this.points.length - 1];
    const dx = point.x - lastPoint.x;
    const dy = point.y - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance >= 2) {
      this.points.push(point);
      this.updatePath();
    }
    
    event.preventDefault();
    event.stopPropagation();
  }
  
  handlePointerUp(event) {
    if (!this.isActive || !this.isDrawing) return;
    
    const wasDrawing = this.isDrawing;
    this.isDrawing = false;
    
    // ポインターのキャプチャを解放
    try {
      event.target.releasePointerCapture(event.pointerId);
    } catch (e) {
      // ignore
    }
    
    if (wasDrawing && this.points.length >= this.options.minPoints) {
      // パスを閉じる
      this.updatePath(true);
      
      // フェードアウトアニメーションを開始
      this.startFadeOut();
      
      // 描画終了コールバック
      if (this.callbacks.onDrawEnd) {
        this.callbacks.onDrawEnd(this.points);
      }
      
      // 選択完了コールバック
      if (this.callbacks.onSelectionComplete) {
        this.callbacks.onSelectionComplete(this.points);
      }
    } else {
      // 点が少なすぎる場合はキャンセル
      this.cancelDrawing();
    }
    
    event.preventDefault();
    event.stopPropagation();
  }
  
  handlePointerCancel(event) {
    this.cancelDrawing();
    event.preventDefault();
    event.stopPropagation();
  }
  
  getPointFromEvent(event) {
    const rect = this.container.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
  
  updatePath(close = false) {
    if (!this.currentPath || this.points.length < 1) return;
    
    let pathData = '';
    
    if (this.points.length === 1) {
      // 1点のみの場合は点を描画
      pathData = `M ${this.points[0].x} ${this.points[0].y} L ${this.points[0].x} ${this.points[0].y}`;
    } else {
      // 複数点の場合はパスを描画
      pathData = `M ${this.points[0].x} ${this.points[0].y}`;
      
      for (let i = 1; i < this.points.length; i++) {
        pathData += ` L ${this.points[i].x} ${this.points[i].y}`;
      }
      
      // パスを閉じる
      if (close && this.points.length >= this.options.minPoints) {
        pathData += ' Z';
      }
    }
    
    this.currentPath.setAttribute('d', pathData);
  }
  
  startFadeOut() {
    if (!this.currentPath) return;
    
    const path = this.currentPath;
    const startTime = Date.now();
    const duration = this.options.fadeOutDuration;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const opacity = 1 - progress;
      
      if (opacity <= 0) {
        if (path.parentNode) {
          path.parentNode.removeChild(path);
        }
        return;
      }
      
      path.style.opacity = opacity;
      this.animationId = requestAnimationFrame(animate);
    };
    
    animate();
  }
  
  cancelDrawing() {
    this.isDrawing = false;
    this.points = [];
    
    if (this.currentPath && this.currentPath.parentNode) {
      this.currentPath.parentNode.removeChild(this.currentPath);
    }
    this.currentPath = null;
  }
  
  clearPaths() {
    // すべてのパスを削除
    while (this.drawGroup.firstChild) {
      this.drawGroup.removeChild(this.drawGroup.firstChild);
    }
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  setStrokeColor(color) {
    this.options.strokeColor = color;
    this.drawGroup.style.filter = `drop-shadow(0 0 8px ${color}80)`;
  }
  
  hexToRgba(hex, alpha = 1) {
    // #RGB or #RRGGBB to rgba()
    let r = 0, g = 0, b = 0;
    
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex[1] + hex[2], 16);
      g = parseInt(hex[3] + hex[4], 16);
      b = parseInt(hex[5] + hex[6], 16);
    }
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  onSelectionComplete(callback) {
    this.callbacks.onSelectionComplete = callback;
  }
  
  onDrawStart(callback) {
    this.callbacks.onDrawStart = callback;
  }
  
  onDrawEnd(callback) {
    this.callbacks.onDrawEnd = callback;
  }
  
  destroy() {
    // イベントリスナーを削除
    this.container.removeEventListener('pointerdown', this.handlePointerDown, { capture: true });
    this.container.removeEventListener('pointermove', this.handlePointerMove, { capture: true });
    this.container.removeEventListener('pointerup', this.handlePointerUp, { capture: true });
    this.container.removeEventListener('pointercancel', this.handlePointerCancel, { capture: true });
    
    // オーバーレイを削除
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    
    // アニメーションをキャンセル
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

// グローバルスコープに公開
window.LassoOverlay = LassoOverlay;
