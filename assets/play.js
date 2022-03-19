/* 演示动画部分
关系代数的运算实际上可以分成一个一个的二元运算或者对关系自身的运算，因此动画针对的也正是两个关系表及其元组
SomeBottle 20220305
*/
'use strict';
const Plays = {
    tickEndEvent: new CustomEvent('ticklistend'),
    playList: [ // 演示列表

    ],
    tickList: [ // 动画计算队列(来自于playList中的某一项)

    ],
    init: function () { // 初始化样式
        let context = this.target.getContext('2d');
        // 设置绘制样式
        context.textAlign = 'center'; // 文字水平居中
        context.textBaseline = 'middle'; // 文字基线居中
        context.font = '1em Fira Code, Monaco, Consolas, Ubuntu Mono, PingFang SC, Hiragino Sans GB, Microsoft YaHei, WenQuanYi Micro Hei, monospace, sans-serif';
        context.fillStyle = '#FAFAFA';
        context.strokeStyle = '#FFF';
        context.lineWidth = 1; // 线宽
        context.save();
        this.context = context;
        this.cellPaddingX = 10; // 单元格的水平padding
        this.cellPaddingY = 10; // 单元格的垂直padding
    },
    x: function (elem) {
        this.target = elem;
        this.init();
        return this;
    },
    setSize: function (canvasW, canvasH) {
        let canvas = this.target;
        canvas.width = canvasW;
        canvas.height = canvasH;
        this.init(); // resize后canvas属性会归为默认，重新初始化
    },
    columnSize: function (table) { // 返回关系表所有的列宽列高(关系表,x轴边缘,y轴边缘)
        let ctx = this.context, // 创建画布对象
            sizes = [[], []],
            columnNum = table[0].length,
            height = [],
            paddingX = this.cellPaddingX,
            paddingY = this.cellPaddingY;
        for (let i = 0; i < columnNum; i++) {
            let width = 0;
            for (let j = 0, len = table.length; j < len; j++) {
                let measurement = ctx.measureText(table[j][i]),
                    strWid = measurement.width,
                    // 这两个属性出现在比较新的规范里，要考虑一下浏览器兼容性，如果不支持就是15
                    strHei = (measurement.actualBoundingBoxAscent + measurement.actualBoundingBoxDescent) || 15;
                strWid = strWid + (paddingX * 2);
                strHei = strHei + (paddingY * 2);
                if (strWid >= width) width = strWid;
                if (strHei >= (height[j] || 0)) height[j] = strHei;
            }
            sizes[0].push(width);
        }
        sizes[1] = height;
        return sizes;
    },
    measureTable: function (relaArr, marginX, marginY) {
        /* 测量关系表(关系对象数组,x轴偏差,y轴偏差)
           根据所有表宽高和margin运算并返回：
           [画布宽,画布高]
        */
        let canvasWd = 0, canvasHt = 0;
        for (let i = 0, len = relaArr.length; i < len; i++) {
            let relaObj = relaArr[i],
                table = Array.from(relaObj['tuples']); // 关系表（浅拷贝）
            table.splice(0, 0, relaObj['attrs']); // 将属性名放入表中
            let [widths, heights] = this.columnSize(table), // 获取列宽列高
                rowWidth = widths.reduce((a, b) => a + b + 2, 0), // 获取表的宽度
                columnHeight = heights.reduce((a, b) => a + b + 2, 0), // 获取表的高度
                marginHt = columnHeight + marginY * 2;
            canvasWd = canvasWd + rowWidth + marginX * 2;
            canvasHt = canvasHt < marginHt ? marginHt : canvasHt;
        }
        return [canvasWd, canvasHt];
    },
    drawTable: function (relaObj, marginX, marginY, offsetX = 0, offsetY = 0) {
        /*
        绘制关系表(关系对象,x轴margin,y轴margin,x轴偏差,y轴偏差)
        返回：[当前表的宽,当前表的高,单元格坐标以及宽高]
        */
        let ctx = this.context, // 获得画布对象
            table = Array.from(relaObj['tuples']), // 浅拷贝
            cellsInfo = []; // 储存绘制每行每格的左上角坐标
        table.splice(0, 0, relaObj['attrs']); // 将属性名放入表中
        let [widths, heights] = this.columnSize(table),
            rowWidth = widths.reduce((a, b) => a + b, 0), // 获取表的宽度
            columnHeight = heights.reduce((a, b) => a + b, 0); // 获取表的高度
        ctx.restore();
        let verticalDrawn = false, // 是否已经绘制了垂直线
            rowsLen = table.length, // 表的行数
            colsLen = table[0].length, // 表的列数
            rowsLinesWidth = colsLen - 1, // 水平线占的总像素数
            colsLinesWidth = rowsLen - 1; // 垂直线占的总像素数
        offsetX = offsetX + marginX;
        offsetY = offsetY + marginY;
        ctx.moveTo(offsetX, offsetY);
        ctx.lineTo(offsetX + rowWidth + rowsLinesWidth, offsetY);
        ctx.moveTo(offsetX, offsetY);
        ctx.lineTo(offsetX, offsetY + columnHeight + colsLinesWidth);
        for (let i = 0; i < rowsLen; i++) {
            cellsInfo[i] = new Array();
            let row = table[i],
                cellsRow = cellsInfo[i],
                ht = heights.slice(0, i + 1).reduce((a, b) => a + b, 0),
                cellHeight = heights[i], // 获取单元格高度
                y = offsetY + ht + i; // 这里i代表当前的水平线条占的像素数
            ctx.moveTo(offsetX, y);
            ctx.lineTo(offsetX + rowWidth + rowsLinesWidth, y);
            for (let j = 0, len2 = row.length; j < len2; j++) {
                let wd = widths.slice(0, j + 1).reduce((a, b) => a + b, 0),
                    cellWidth = widths[j], // 获取单元格宽度
                    x = offsetX + wd + j, // 这里j代表当前的竖直线条占的像素数
                    text = row[j],
                    textWd = widths[j],
                    textHt = heights[i]; // 获取文字宽高
                if (!verticalDrawn) {
                    ctx.moveTo(x, offsetY);
                    ctx.lineTo(x, offsetY + columnHeight + colsLinesWidth);
                }
                ctx.fillText(text, x - textWd / 2, y - textHt / 2);
                // 记录画布中当前单元格的左上角坐标以及单元格宽高[x,y,cellWidth,cellHeight]（单元格右下角坐标减去单元格长宽）
                cellsRow.push([x - cellWidth, y - cellHeight, cellWidth, cellHeight, text]);
            }
            verticalDrawn = true;
        }
        ctx.stroke();
        let tableWidth = rowWidth + marginX * 2,
            tableHeight = columnHeight + marginY * 2;
        return [tableWidth, tableHeight, cellsInfo];
    },
    eraseCells: function (cells2mask) { // 遮住指定单元格，传入格式和cellsInfo一致
        let ctx = this.context;
        ctx.save();
        ctx.strokeStyle = '#101010';
        for (let i = 0, len = cells2mask.length; i < len; i++) {
            let [cellX, cellY, cellWd, cellHt] = cells2mask[i];
            ctx.clearRect(cellX, cellY, cellWd, cellHt);
            ctx.strokeRect(cellX, cellY, cellWd, cellHt);
        }
        ctx.restore();
    },
    framesMaker: function (curve, frames, init, end) {
        /*
            根据曲线生成帧数组，从init到end
            (曲线,帧数,起始数值,结束数值)
        */
        let diff = end - init, // 计算出首尾差值，这个相当于路程.
            halfDiff = diff / 2, // 计算出首尾差值的一半(用于淡入淡出)
            halfFrames = Math.round(frames / 2),
            acceleration = (diff * 2) / (frames ** 2), // 加速度a=2s/t^2
            velo, // 初速度
            finalFrames = []; // 最终输出帧数组
        switch (curve) {
            case 'easeIn': // 缓入
                velo = 0;
                break;
            case 'easeOut':
                let finalVelo = acceleration * frames; // Vt=0+a*t 末速度
                velo = finalVelo; // 初速度最大
                acceleration = -acceleration; // 加速度取反
                break;
            case 'easeInOut':
                let leftFrames = frames - halfFrames,
                    leftDiff = diff - halfDiff,
                    frames1 = this.framesMaker('easeIn', halfFrames, init, init + halfDiff),
                    frames2 = this.framesMaker('easeOut', leftFrames, end - leftDiff, end);
                return frames1.concat(frames2);
            default: // 线性匀速
                acceleration = 0;
                velo = diff / frames; // frames其实相当于时间
                break;
        }
        for (let i = 0; i < frames - 1; i++) { // 时间从0开始，循环到frames-1
            let currentVelo = velo + acceleration * i;
            init = init + currentVelo;
            finalFrames.push(
                diff >= 0 ? Math.min(init, end) : Math.max(init, end)
            );
        }
        finalFrames.push(end); // 最后一帧
        return finalFrames;
    },
    addCellsAni: function (cellsObj, animArr, index = false) {
        // 添加单元格集动画(单元格组对象,动画属性,插入在哪(默认最后))
        /* animArr [动画类型(运动,透明度,强调),播放动画的帧数量,曲线,开始状态,结束状态]
            其中开始状态和结束状态是数组，如果是运动，则为[x,y];如果是透明度，则是数值;如果是强调，则是[r,g,b,a]。
        */
        let [animType, frames, curve, init, end] = animArr,
            animItem = [cellsObj, animType, []],
            playList = this.playList;
        switch (animType) {
            case 'movement':
                let [initX, initY] = init,
                    [endX, endY] = end,
                    xFrames = this.framesMaker(curve, frames, initX, endX),
                    yFrames = this.framesMaker(curve, frames, initY, endY);
                animItem[2] = zip(xFrames, yFrames);
                break;
            case 'opacity':
                let initOpacity = init,
                    endOpacity = end;
                animItem[2] = this.framesMaker(curve, frames, initOpacity, endOpacity);
                break;
            case 'emphasis':
                let [initR, initG, initB, initA] = init,
                    [endR, endG, endB, endA] = end,
                    rFrames = this.framesMaker(curve, frames, initR, endR),
                    gFrames = this.framesMaker(curve, frames, initG, endG),
                    bFrames = this.framesMaker(curve, frames, initB, endB),
                    aFrames = this.framesMaker(curve, frames, initA, endA);
                animItem[2] = zip(rFrames, gFrames, bFrames, aFrames);
                break;
        }
        index = index === false ? playList.length : index;
        if (!(playList[index] instanceof Array)) {
            playList[index] = [];
        }
        playList[index].push(animItem); // 添加动画
        return index; // 返回添加的位置
    },
    tickAnim: function () { // 计算一次动画
        let readyToBreak = false, // 是否结束tick
            that = Plays,
            list = that.tickList,
            listLen = list.length
        for (let i = 0; i < listLen; i++) {
            let [cellsObj, animType, frames] = list[i],
                currentFrame = frames.shift()
            if (!currentFrame) {
                readyToBreak = true; // 设一个标记
                continue; // 跳出当前循环
            } else {
                readyToBreak = false; // 还有帧就不结束tick
            }
            switch (animType) {
                case 'movement':
                    let [x, y] = currentFrame;
                    cellsObj.moveTo(x, y);
                    break;
                case 'opacity':
                    let opacity = currentFrame;
                    cellsObj.clear();
                    cellsObj.draw(opacity);
                    break;
                case 'emphasis':
                    let [r, g, b, a] = currentFrame;
                    cellsObj.clearEmphases();
                    cellsObj.emphasize(r, g, b, a);
                    break;
            }
        }
        if (readyToBreak || listLen <= 0) { // 如果所有动画都结束了就跳出
            list.length = 0; // 清空当前的动画列表
            window.dispatchEvent(that.tickEndEvent);
        } else {
            window.requestAnimationFrame(that.tickAnim); // 否则继续tick
        }
    }
};

const cellsGroup = function (cells) { // 将多个单元格组合成一个单元格组进行操作
    let firstCell = cells[0], // 取出第一个单元格
        canvas = s('.playLayer > #tuples'),
        emphasesCanvas = s('.playLayer > #emphases'),
        ctx = canvas.getContext('2d'),
        emphasesCtx = emphasesCanvas.getContext('2d'),
        [originX, originY] = firstCell, // 单元格组的坐标是第一个单元格的坐标
        [canvasWd, canvasHt] = [canvas.width, canvas.height];
    emphasesCanvas.width = canvasWd; // 设置强调层宽高
    emphasesCanvas.height = canvasHt;
    [this.x, this.y] = [originX, originY];
    this.cells = cells;
    this.draw = function (opacity = 1) { // 绘制单元格组(透明度)
        for (let i = 0, len = this.cells.length; i < len; i++) {
            let [x, y, wd, ht, text] = this.cells[i];
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.fillStyle = '#101010';
            ctx.fillRect(x, y, wd, ht);
            ctx.strokeRect(x, y, wd, ht);
            ctx.fillStyle = '#FFF';
            ctx.fillText(text, x + wd / 2, y + ht / 2);
            ctx.restore();
        }
    }
    this.clear = function () {
        ctx.clearRect(0, 0, canvasWd, canvasHt);
    }
    this.moveTo = function (x, y) { // 移动单元格组
        let diffX = x - this.x,
            diffY = y - this.y; // 计算移动的距离
        [this.x, this.y] = [x, y]; // 更新首格坐标
        for (let i = 0, len = this.cells.length; i < len; i++) { // 从第二个单元格开始移动
            let cell = this.cells[i];
            cell[0] += diffX;
            cell[1] += diffY;
        }
        this.clear();
        this.draw();
    }
    this.clearEmphases = function () {
        emphasesCtx.clearRect(0, 0, canvasWd, canvasHt);
    }
    this.emphasize = function (r, g, b, a) { // 强调单元格组
        emphasesCtx.fillStyle = `rgba(${r},${g},${b},${a})`;
        for (let i = 0, len = this.cells.length; i < len; i++) {
            let [x, y, wd, ht] = this.cells[i];
            emphasesCtx.fillRect(x, y, wd, ht);
        }
    }
}

/*
// Testing code
function gene(pos) {
    s('#emphases').width = '1920';
    s('#emphases').height = '1080';
    let ctx = s('#emphases').getContext('2d');
    ctx.fillStyle = '#FFF';
    ctx.clearRect(0, 0, 1920, 1080);
    ctx.fillRect(pos, 30, 20, 20);
}
let current = 0;
let result = Plays.framesMaker('easeOut', 200, 0, 500);
console.log(result);
let animation = () => {
    gene(result[current]);
    current = current < result.length ? current + 1 : 0;
    window.requestAnimationFrame(animation);
};
window.requestAnimationFrame(animation);
*/