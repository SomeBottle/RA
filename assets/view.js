'use strict';
var s = (selector, all = false) => all ? document.querySelectorAll(selector) : document.querySelector(selector);/*简化一下选择器*/
/*在字符串原型链上加个提取模板占位名的方法*/
String.prototype.exactTp = function () {
    return this.replace('{[', '').replace(']}', '');
}
/*在字符串原型链上加个寻找模板占位符的方法*/
String.prototype.findTp = function () {
    return this.match(new RegExp('\\{\\[(\\S*)\\]\\}', 'gi'));
}
/*在字符串原型链上加个替换模板占位符的方法*/
String.prototype.replaceTp = function (from, to) {
    return this.replace(new RegExp('\\{\\[' + from + '\\]\\}', 'gi'), to);
}
var basicView = {
    langList: {},
    currentLang: {},
    originalTemplates: '',
    loadedPages: {},
    motionChecker: function (element, func, checkAnim = false) {/*CSS3运动结束监听回调器(监听元素,回调函数,监听的是不是css3Animation)*/
        let chosenTester = '', testers = checkAnim ? {
            'animation': 'animationend',
            'OAnimation': 'oAnimationEnd',
            'MozAnimation': 'animationend',
            'WebkitAnimation': 'webkitAnimationEnd'
        } : {
            'transition': 'transitionend',
            'OTransition': 'oTransitionEnd',
            'MozTransition': 'transitionend',
            'WebkitTransition': 'webkitTransitionEnd'
        };
        for (var i in testers) {
            if (element.style[i] !== undefined) {
                chosenTester = testers[i];
            }
        }
        function callBack() {
            element.removeEventListener(chosenTester, callBack);
            func();
        }
        element.addEventListener(chosenTester, callBack);
    },
    closeNotice: function () {
        let noticer = s('.notice');
        noticer.style.transform = 'translateY(-100%)';
        basicView.motionChecker(noticer, () => {
            s('.notice span').style.float = 'left';
            s('.notice a').style.display = 'block';
        })
    },
    notice: function (content, needConfirm = false) { /*弹出提示(提示内容,是否要用户确认)*/
        let noticer = s('.notice'), that = this;
        noticer.style.transform = 'translateY(0)';
        s('.notice span').innerHTML = content;
        if (!needConfirm) {
            s('.notice span').style.float = 'initial';
            s('.notice a').style.display = 'none';
        }
        this.motionChecker(noticer, () => {
            if (!needConfirm) setTimeout(that.closeNotice, 1500);
        })
    },
    init: function () {
        /*最先拉取语言*/
        let bv = this;
        fetch('./langs/index.json')
            .then((resp) => resp.json())
            .then((resp) => {
                localStorage.RAchosenLang = localStorage.RAchosenLang || resp.defaultLang;
                /*载入语言列表*/
                bv.langList = resp.langList;
                /*选定语言*/
                let chosenLang = localStorage.RAchosenLang;
                console.log('Choose Language:' + bv.langList[chosenLang]);
                return fetch('./langs/' + chosenLang + '.json');
            })
            .catch(error => {
                bv.notice('Language config load failed.Please contact SomeBottle', true);
                console.error(error);
            })
            .then((langResp) => langResp.json())
            .then((langResp) => {
                let basicView = s('.basicView'), basicViewTemplate = bv.originalTemplates || basicView.innerHTML;
                /*储存本来的容器模板，以后还有用*/
                bv.originalTemplates = basicViewTemplate;
                /*获得选择的语言对应的配置文件*/
                bv.currentLang = langResp;
                /*找出所有的替换符号*/
                let matches = basicViewTemplate.findTp(), viewLang = langResp.theView;
                for (var i in matches) {
                    /*获得模板占位名*/
                    let theHolder = matches[i].exactTp();
                    console.log(theHolder);
                    /*如果在语言配置文件中有对应翻译，就替换上，反之就是缺失翻译，保留类似menu.howToUse的占位字串*/
                    basicViewTemplate = basicViewTemplate.replaceTp(theHolder, viewLang[theHolder] || theHolder);
                }
                /*重渲染翻译后的外观*/
                basicView.innerHTML = basicViewTemplate;
                basicView.style.opacity = 1;
                /*初始化菜单，使点击事件与浮页关联*/
                let menuLinks = s('.menu a', true);
                for (i in menuLinks) {
                    let e = menuLinks[i], attr = (typeof e == 'object' ? e.getAttribute('data-src') : null);
                    if (attr) e.addEventListener('click', () => bv.float(attr), false);
                }
            })
    },
    float: function (page) {
        let fl = s('.floatLayer'), fc = s('.floatContent'), bv = this, localPage = bv.loadedPages[page];
        if (localPage) {
            fc.innerHTML = localPage;
            fl.style.zIndex = 50;
            fl.style.opacity = 1;
        } else {
            fetch('./pages/' + page + '.html')
                .then((resp) => resp.text())
                .then((resp) => {
                    fc.innerHTML = resp;
                    bv.loadedPages[page] = resp;
                    fl.style.zIndex = 50;
                    fl.style.opacity = 1;
                })
                .catch(error => {
                    bv.notice('Float page load failed', true);
                    console.error(error);
                })
        }
    },
    closeFloat: function () {
        let fl = s('.floatLayer'), bv = this;
        fl.style.opacity = 0;
        bv.motionChecker(fl, () => {
            fl.style.zIndex = -1;
        });
    }
};

var tableView = {
    all: function () {/*查看所有的表*/
        basicView.float("tableView");
    }
};