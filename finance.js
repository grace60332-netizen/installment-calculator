/**
 * finance.js
 * 金融公式工具
 * Version 1.0
 */

//======================
// 金額格式
//======================

function formatMoney(value) {

    return Number(value).toLocaleString("zh-TW",{
        maximumFractionDigits:0
    });

}


//======================
// ROUNDUP
//======================

function roundUp(value,digits=0){

    if(digits>=0){

        const factor=Math.pow(10,digits);

        return Math.ceil(value*factor)/factor;

    }

    const factor=Math.pow(10,-digits);

    return Math.ceil(value/factor)*factor;

}


//======================
// PMT
//======================

function PMT(rate,nper,pv,fv=0,type=0){

    if(rate===0){

        return -(pv+fv)/nper;

    }

    const pvif=Math.pow(1+rate,nper);

    return -(rate*(pv*pvif+fv))/((pvif-1)*(1+rate*type));

}


//======================
// FV
//======================

function FV(rate,nper,pmt,pv=0,type=0){

    if(rate===0){

        return -(pv+pmt*nper);

    }

    const pow=Math.pow(1+rate,nper);

    return -(pv*pow+pmt*(1+rate*type)*(pow-1)/rate);

}


//======================
// PV
//======================

function PV(rate,nper,pmt,fv=0,type=0){

    if(rate===0){

        return -(fv+pmt*nper);

    }

    const pow=Math.pow(1+rate,nper);

    return -(fv+pmt*(1+rate*type)*(pow-1)/rate)/pow;

}


//======================
// 剩餘本金
//======================

function remainBalance(balance,monthlyRate,months,payment){

    let b=balance;

    for(let i=0;i<months;i++){

        b=b*(1+monthlyRate)-payment;

    }

    return b;

}
