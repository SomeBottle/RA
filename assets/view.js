'use strict';
var s = (selector) => document.querySelector(selector);/*简化一下选择器*/
var basicView = {
    langList:{},
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
        fetch('./lang/index.json')
            .then((resp) => resp.json())
            .then((resp) => {
                localStorage.chosenLang = localStorage.chosenLang || resp.defaultLang;
                /*载入语言列表*/
                bv.langList=resp.langList;
                
            })
            .catch(error => {
                bv.notice('Language config load failed.Please contact SomeBottle', true);
                console.error(error);
            })
    }
}