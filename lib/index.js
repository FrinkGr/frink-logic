var moment = require('moment-timezone'),
  tz = require('tz-lookup'),
  CountryCoo = require('./CountryCodesToCoo');

// gaming cycle in utc is from 4 in the morning to 4 the other day!
var defaultOptions = {
  ommit: ['_id', 'effectiveDay', 'effectiveFrom', 'effectiveUntil'],
  // utc is 3 hours behind Greece
  validFrom: process.env.FRINKS_VALID_FROM ? parseInt(process.env.FRINKS_VALID_FROM) : 7, // hour to start from UTC based
  validFor: {hours: process.env.FRINKS_VALID_FOR ? parseInt(process.env.FRINKS_VALID_FOR) : 24},
  collection: 'timetablefrinks'
};
var mergeOptions = function (options) {
  var finalOptions = defaultOptions;
  for (var option in options) {
    finalOptions[option] = options[option];
  }
  return finalOptions;
};

var Frinks = function (context, options) {
  this.options = mergeOptions(options);
  this.context = context || {};

  var countryCoo = CountryCoo[this.context.country || 'gr'];
  var tzwhere = tz(countryCoo.lat, countryCoo.long);
  this.effectiveDate = context && context.effectiveDate ? moment.tz(context.effectiveDate, tzwhere) : moment.tz(tzwhere);
  this.shiftedDate = this.effectiveDate.isBefore(this.effectiveDate.clone().hours(this.options.validFrom).minutes(0).seconds(0).milliseconds(0));

  // normalise shiftedDate to the exact time start of gaming cycle
  if (this.shiftedDate) {
    this.effectiveDate.subtract(1, 'day').hours(this.options.validFrom).minutes(0).seconds(0).milliseconds(0);
  } else {
    this.effectiveDate.hours(this.options.validFrom).minutes(0).seconds(0).milliseconds(0);
  }
  this.effectiveDay = this.effectiveDate.clone().format('dddd').toLowerCase();
  this.effectiveFrom = this.effectiveDate.clone();
  this.effectiveUntil = this.effectiveDate.clone().add(1, 'day');


  this.id = this.effectiveDate.clone().format('YYYYMMDD');
  this.country = this.context.country || 'gr';
  this.tzwhere = tzwhere;
  this.amount = this.context.amount ? this.context.amount : 0;
  this.reserved = this.context.reserved ? this.context.reserved : 0;
  this.consumed =this.context.consumed ? this.context.consumed : 0;
  this.venues = {};
};


/**
 * Used to sync current object with the database
 * @param adapter
 * @param callback
 */
Frinks.prototype.sync = function (adapter, callback) {
  var that = this;

  adapter
    .collection(that.options.collection)
    .findOne({id: that.id, country: that.country}, function (error, frinks) {
      if (error) return callback(error);
      that.fill(frinks);
      return callback(null, that);
    });
};


/**
 * Used to reserve a frink for a bar
 * Increase global reserved amount
 * Increase venue's reserved amount
 * Decrease venue's free frinks amount
 * @param adapter
 * @param venue
 * @param callback
 */
Frinks.prototype.reserve = function (adapter, venue, callback) {
  var that = this;
  var matchQuery = {id: that.id, country: that.country};
  matchQuery['venues.' + venue + '.amount'] = {$gt: 0};
  var reserveUpdate = {reserved: +1};
  reserveUpdate['venues.' + venue + '.reserved'] = +1;
  reserveUpdate['venues.' + venue + '.amount'] = -1;

  adapter.collection(this.options.collection).update(matchQuery, {$inc: reserveUpdate}, function (error, result) {
    if (error) {
      return callback(error);
    }
    return callback(null, that);
  });
};

/**
 * Used to unreserve a frink for a bar
 * Decrease global reserved amount
 * Decrease venue's reserved amount
 * Increase venue's free frinks amount
 * @param adapter
 * @param venue
 * @param callback
 */
Frinks.prototype.unreserve = function (adapter, venue, callback) {
  var that = this;
  var matchQuery = {id: that.id, country: that.country};
  matchQuery['venues.' + venue + '.reserved'] = {$gt: 0};
  var unreserveUpdate = {reserved: -1};
  unreserveUpdate['venues.' + venue + '.reserved'] = -1;
  unreserveUpdate['venues.' + venue + '.amount'] = +1;

  adapter.collection(this.options.collection).update(matchQuery, {$inc: unreserveUpdate}, function (error, result) {
    if (error) {
      return callback(error);
    }
    return callback(null, that);
  });
};


/**
 * Used to consume (validate) a frink at a bar
 * Increase global consumed amount
 * Increase venue's consumed amount
 * @param adapter
 * @param venue
 * @param callback
 */
Frinks.prototype.consume = function (adapter, venue, callback) {
  var that = this;
  var consumeUpdate = {consumed: +1};
  consumeUpdate['venues.' + venue + '.consumed'] = +1;

  adapter.collection(this.options.collection).update({
    id: that.id,
    country: that.country
  }, {$inc: consumeUpdate}, function (error, result) {
    if (error) {
      return callback(error);
    }
    return callback(null, that);
  });
};


/**
 * Used when to return a frink to a bar due to an invalid completion
 * Decrease global consumed amount
 * Decrease global reserved amount
 * Descrease venue's consumed amount
 * Decrease venue's reserved amount
 * Increase venue's free frinks amount
 * @param adapter
 * @param venue
 * @param callback
 */
Frinks.prototype.revoke = function (adapter, venue, callback) {
  var that = this;

  var releaseUpdate = {consumed: -1, reserved: -1};
  releaseUpdate['venues.' + venue + '.consumed'] = -1;
  releaseUpdate['venues.' + venue + '.reserved'] = -1;
  releaseUpdate['venues.' + venue + '.amount'] = +1;

  adapter.collection(this.options.collection).update({
    id: that.id,
    country: that.country
  }, {$inc: releaseUpdate}, function (error, result) {
    if (error) {
      return callback(error);
    }
    return callback(null, that);
  });
};


/**
 * Finds a venue
 * @param venue
 * @returns {*}
 */
Frinks.prototype.venue = function (venue) {
  return this.venues[venue];
};

Frinks.prototype.isInThisFrinkPeriod = function(date) {
  return moment.tz(date, this.tzwhere).isBetween(this.effectiveFrom, this.effectiveUntil);
}

/**
 * Fill timetable with context
 * @param context
 */
Frinks.prototype.fill = function (context) {
  for (var element in context) {
    if (this.options.ommit.indexOf(element) === -1 && this.hasOwnProperty(element)) {
      this[element] = context[element];
    }
  }
};



exports = module.exports = Frinks;
