/**
 * 手写画板模块
 * 基于 Canvas 实现，支持鼠标与触屏书写，带田字格辅助线。
 * 用户在学习汉字后需在此书写，以完成打卡。
 */
const HandwritingPad = (function () {
  /**
   * 初始化一个手写画板
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts { size, color, width }
   */
  function init(canvas, opts = {}) {
    const size = opts.size || 280;
    const color = opts.color || '#222';
    const lineWidth = opts.width || 6;

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    let drawing = false;
    let hasInk = false;
    let strokeCount = 0;
    let strokes = [];   // 每笔: { start:{x,y}, end:{x,y} }
    let currentStart = null;
    let last = null;

    function drawGrid() {
      ctx.save();
      ctx.clearRect(0, 0, size, size);
      // 背景
      ctx.fillStyle = '#fffdf7';
      ctx.fillRect(0, 0, size, size);
      // 外框
      ctx.strokeStyle = '#e8a87c';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, size - 2, size - 2);
      // 田字格辅助线
      ctx.strokeStyle = 'rgba(232,168,124,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
      ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    function pos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const touch = e.touches ? e.touches[0] : e;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    function start(e) {
      e.preventDefault();
      drawing = true;
      strokeCount++;
      currentStart = pos(e);
      last = currentStart;
    }

    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = pos(e);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      hasInk = true;
      if (opts.onInk) opts.onInk();
    }

    function end(e) {
      if (e) e.preventDefault();
      if (drawing && currentStart && last) {
        strokes.push({ start: currentStart, end: { ...last } });
      }
      drawing = false;
      currentStart = null;
      last = null;
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });

    drawGrid();

    return {
      clear() { drawGrid(); hasInk = false; strokeCount = 0; strokes = []; if (opts.onInk) opts.onInk(); },
      hasInk() { return hasInk; },
      /** 获取已书写的笔画数（落笔次数） */
      getStrokeCount() { return strokeCount; },
      /** 获取每笔的起止坐标 [{start:{x,y}, end:{x,y}}, ...] */
      getStrokes() { return strokes; },
      /** 导出手写图片为 dataURL */
      toDataURL() { return canvas.toDataURL('image/png'); },
    };
  }

  return { init };
})();
