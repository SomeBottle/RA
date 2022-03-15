/* 演示动画部分
关系代数的运算实际上可以分成一个一个的二元运算或者对关系自身的运算，因此动画针对的也正是两个关系表及其元组
SomeBottle 20220305
*/
'use strict';
const Plays = {
    playList: [ // 演示列表

    ],
    tickList: [ // 动画计算队列

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
                cellsRow.push([x - cellWidth, y - cellHeight, cellWidth, cellHeight]);
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
    addCellsAni: function (cellsArr, animArr, step = false) {
        // 添加单元格集动画(单元格数组,动画属性,插入在哪一步(默认最后))
        let item = [cellsArr, animArr];
        if (!step) {
            this.playList.push(item);
        } else {
            this.playList.splice(step, 0, item);
        }
    },
    tickAnim: function () { // 计算一次动画
        for (let i = 0, len = this.tickList.length; i < len; i++) {
            let [cellsArr, animArr] = this.tickList[i];
            for (let j = 0, len2 = cellsArr.length; j < len2; j++) {
                let cell = cellsArr[j];
            }
        }
    }
};