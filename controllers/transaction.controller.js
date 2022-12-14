var $ = require("jquery");
const AppError = require("../utils/appError");
const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const { Transaction } = require("../models");

exports.createPaymentURL = catchAsync(async (req, res, next) => {
  try {
    var ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

    var config = require("config");
    var dateFormat = require("dateformat");

    var tmnCode = config.get("vnp_TmnCode");
    var secretKey = config.get("vnp_HashSecret");
    var vnpUrl = config.get("vnp_Url");
    var returnUrl = config.get("vnp_ReturnUrl");

    var date = new Date();

    var createDate = dateFormat(date, "yyyymmddHHmmss");
    var orderId = dateFormat(date, "HHmmss");
    var amount = req.body.amount;
    var bankCode = req.body.bankCode || null;

    var orderInfo =
      req.body.orderDescription ||
      "Thanh toan don hang thoi gian: " +
        dateFormat(date, "yyyy-mm-dd HH:mm:ss");
    var orderType = req.body.orderType || "topup";
    var locale = req.body.language || null;
    if (locale === null || locale === "") {
      locale = "vn";
    }

    var currCode = "VND";
    var vnp_Params = {};
    vnp_Params["vnp_Version"] = "2.1.0";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = tmnCode;
    // vnp_Params['vnp_Merchant'] = ''
    vnp_Params["vnp_Locale"] = locale;
    vnp_Params["vnp_CurrCode"] = currCode;
    vnp_Params["vnp_TxnRef"] = orderId;
    vnp_Params["vnp_OrderInfo"] = orderInfo;
    vnp_Params["vnp_OrderType"] = orderType;
    vnp_Params["vnp_Amount"] = amount * 100;
    vnp_Params["vnp_ReturnUrl"] = returnUrl;
    vnp_Params["vnp_IpAddr"] = ipAddr;
    vnp_Params["vnp_CreateDate"] = createDate;
    if (bankCode !== null && bankCode !== "") {
      vnp_Params["vnp_BankCode"] = bankCode;
    }

    vnp_Params = sortObject(vnp_Params);

    var querystring = require("qs");
    var signData = querystring.stringify(vnp_Params, { encode: false });
    var crypto = require("crypto");
    var hmac = crypto.createHmac("sha512", secretKey);
    var signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");
    vnp_Params["vnp_SecureHash"] = signed;
    vnpUrl += "?" + querystring.stringify(vnp_Params, { encode: false });

    res.json({
      url: vnpUrl,
      // accessToken: req.accessToken,
    });
  } catch (err) {
    console.log(err);
  }
});

exports.response = catchAsync(async (req, res, next) => {
  const { amount, name_bank } = req.body;
  let transaction = new Transaction({
    money: amount,
    service_package: "G??i MAX",
    name_bank,
  });
  if (amount == "79200000") {
    transaction.kind_package = "12 th??ng";
  } else if (amount == "3960000") {
    transaction.kind_package = "6 th??ng";
  } else {
    transaction.kind_package = "1 th??ng";
  }

  req.user.isVip = true;
  transaction.user = req.user._id;
  await transaction.save();
  req.user.transaction.push(transaction._id);
  await req.user.save();
  console.log(transaction);

  // console.log(req.user);
  res.json({
    status: httpStatus.CREATED,
  });
});

exports.vnPayReturn = (req, res, next) => {
  console.log("return");
  var vnp_Params = req.query;

  var secureHash = vnp_Params["vnp_SecureHash"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  var config = require("config");
  var tmnCode = config.get("vnp_TmnCode");
  var secretKey = config.get("vnp_HashSecret");

  var querystring = require("qs");
  var signData = querystring.stringify(vnp_Params, { encode: false });
  var crypto = require("crypto");
  var hmac = crypto.createHmac("sha512", secretKey);
  var signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");

  if (secureHash === signed) {
    //Kiem tra xem du lieu trong db co hop le hay khong va thong bao ket qua

    res.render("success", { code: vnp_Params["vnp_ResponseCode"] });
  } else {
    res.render("success", { code: "97" });
  }
};

function sortObject(obj) {
  var sorted = {};
  var str = [];
  var key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}
