/**
 * Created by spiritinlife on 10/2/15.
 */
var should = require('should'),
  moment = require('moment-timezone'),
  uuid = require("node-uuid"),
  db = require('mongojs')("test-frink", ['timetablefrinks'], {authMechanism: 'ScramSHA1'});


//dependencies
var FrinksLib = require("../lib");

describe('Frinks', function () {
  describe('#construction', function () {

    it('checks construction of frink model with default context', function () {
      var frinks = new FrinksLib();
      frinks.should.have.property('options');
      frinks.options.should.have.property('collection', 'timetablefrinks');
      frinks.should.have.property('context');
      frinks.should.have.property('effectiveDate');
      frinks.should.have.property('shiftedDate');
      frinks.should.have.property('effectiveDay');
      frinks.should.have.property('effectiveFrom');
      frinks.should.have.property('effectiveUntil');
    });

    it('should have as default collection : timetablefrinks', function () {
      var frinks = new FrinksLib();
      frinks.options.should.have.property('collection', 'timetablefrinks');
    });

  });

  describe('#date shifting', function () {

    describe('#shiftedDate', function () {

      it('should be shiftedDate if effectiveDate is after  midnight', function () {
        var now = moment.tz('Europe/Athens').hours(3);
        var context = {
          effectiveDate: now
        };
        var frinks = new FrinksLib(context);
        frinks.shiftedDate.should.equal(true);
      });


      describe('if it is a shiftedDate', function () {
        var now = moment.tz('Europe/Athens').hours(3);
        var context = {
          effectiveDate: now
        };
        var frinks = new FrinksLib(context);
        var yesterday = now.subtract(1, 'day').hours(frinks.options.validFrom).minutes(0).seconds(0).milliseconds(0);

        it('effectiveDate should be yesterday at the start at the start of the gaming cycle', function () {
          var isYesterday = frinks.effectiveDate.day() == yesterday.day();
          isYesterday.should.equal(true)
        });

        it('effectiveDay should be a lowercase string and it should be yesterday\'s name of day', function () {
          var yesterdayReadable = yesterday.format('dddd').toLowerCase();
          var isYesterdayReadable = frinks.effectiveDay === yesterdayReadable;
          isYesterdayReadable.should.equal(true)
        })

        it('effectiveFrom should equal yesterday', function () {
          // this is actually the effectiveDate
          (frinks.effectiveFrom.diff(yesterday, 'milliseconds')).should.equal(0);
        })

        it('effectiveUntil should equal yesterday + 24 hours', function () {
          // this is actually the effectiveDate
          (frinks.effectiveUntil.diff(yesterday, 'hours')).should.equal(24);
        })

        it('id should be yesterday\'s YYYYMMDD', function () {
          // this is actually the effectiveDate
          (frinks.id === yesterday.format('YYYYMMDD')).should.equal(true);
        })

      });

      it('should not be shiftedDate if effectiveDate is before  midnight', function () {
        var now = moment.tz('Europe/Athens').hours(10);
        var context = {
          effectiveDate: now
        };
        var frinks = new FrinksLib(context);
        frinks.shiftedDate.should.equal(false);
      });

      describe('if it is not a shiftedDate', function () {
        var now = moment.tz('Europe/Athens').hours(10);
        var context = {
          effectiveDate: now
        };
        var frinks = new FrinksLib(context);

        it('effectiveDate should be today at the start of the gaming cycle', function () {
          var isToday = frinks.effectiveDate.day() === now.day();
          isToday.should.equal(true)
        });

        it('effectiveDay should be a lowercase string and it should be today\'s name of day', function () {
          var todayReadable = now.format('dddd').toLowerCase();
          var isTodayReadable = frinks.effectiveDay === todayReadable;
          isTodayReadable.should.equal(true)
        })

        it('effectiveFrom should equal to today\'s start of gaming cycly ', function () {
          (frinks.effectiveFrom.diff(now.hours(frinks.options.validFrom).minutes(0).seconds(0).milliseconds(0), 'milliseconds')).should.equal(0);
        })

        it('effectiveUntil should equal to today\'s gaming cycle + 24 hours', function () {
          (frinks.effectiveUntil.diff(now.hours(frinks.options.validFrom).minutes(0).seconds(0).milliseconds(0), 'hours')).should.equal(24);
        })

        it('id should be today\'s YYYYMMDD', function () {
          (frinks.id === now.format('YYYYMMDD')).should.equal(true);
        })
      });
    });
  });

  describe('#TESTS on id which is what is used to retrieve the correct timetablefrinks', function () {

    var tests = [

      // gr is +300 (with dst)so when utc is 4 gr is 7 and so it is the shifted date
      {arg: moment.utc("2015-10-02 00:01Z"), country: 'gr', expected: "20151001"},
      {arg: moment.utc("2015-10-02 03:59Z"), country: 'gr', expected: "20151001"},// this is a shifted date since we are after midnight so return 20151001
      {arg: moment.utc("2015-10-02 03:59Z"), country: 'gr', expected: "20151001"},
      {arg: moment.utc("2015-10-02 04:00Z"), country: 'gr', expected: "20151002"},
      {arg: moment.utc("2015-10-02 04:01Z"), country: 'gr', expected: "20151002"},
      {arg: moment.utc("2015-10-02 12:01Z"), country: 'gr', expected: "20151002"},

      // colombia (co) is -500 so when utc 4 co is 23
      // so shifted date should happen at 7 colombian time which is 12 utc
      {arg: moment.utc("2015-10-02 11:59"), country: 'co', expected: "20151001"},
      {arg: moment.utc("2015-10-02 12:00"), country: 'co', expected: "20151002"},
      {arg: moment.utc("2015-10-02 12:01"), country: 'co', expected: "20151002"},

      // france (fr) is +200 (with dst) so when utc is 4 fr is 6
      // so shifted date should happen at 7 fr time which is 5 utc
      {arg: moment.utc("2015-10-02 04:59"), country: 'fr', expected: "20151001"},
      {arg: moment.utc("2015-10-02 05:00"), country: 'fr', expected: "20151002"},
      {arg: moment.utc("2015-10-02 05:01"), country: 'fr', expected: "20151002"},


    ];

    tests.forEach(function (test) {
      it('correctly finds ' + test.country + ' ' + test.arg.format() + ' to have id of ' + test.expected, function () {
        var context = {
          effectiveDate: test.arg,
          country: test.country
        };
        var frinks = new FrinksLib(context);
        frinks.id.should.equal(test.expected);
      });
    });

  });

  describe('#Test frink logic', function () {
    var today = moment.tz('Europe/Athens');
    var todayId = today.format('YYYYMMDD');
    var venueId = uuid.v1();
    var venues = {};
    venues[venueId] = {
      "price": "5",
      "sex": "0",
      "age": [
        "18",
        "60"
      ],
      "amount": 4,
      "reserved": 1
    };
    var timetableFrink = {
      id: todayId,
      country : 'gr',
      venues: venues,
      amount: 4,
      reserved: 1
    };

    beforeEach(function (done) {
      db.timetablefrinks.remove({id: todayId}, function (err, result) {
        db.timetablefrinks.insert(timetableFrink, function (err, result) {
          done();
        })
      });
    });


    describe('#reserve()', function () {

      beforeEach("Calling reserve", function (done) {
        var frinks = new FrinksLib();
        frinks.reserve(db, venueId, function (err, res) {
          done();
        });
      });


      it('should decrease amount of venue by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.venue(venueId).amount.should.equal(3);
          done();
        })
      });

      it('should increase amount of reservations at the venue by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.venue(venueId).reserved.should.equal(2);
          done();
        });
      });

      it('should increase global amount of reservations by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.reserved.should.equal(2);
          done();
        });
      });

    });

    describe('#unreserve()', function () {

      beforeEach("Calling unreserve", function (done) {
        var frinks = new FrinksLib();
        frinks.unreserve(db, venueId, function (err, res) {
          done();
        });
      });


      it('should decrease global reserved amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.reserved.should.equal(0);
          done();
        })
      });

      it('should decrease venue\'s reserved amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.venue(venueId).reserved.should.equal(0);
          done();
        });
      });


      it('should increase venue\'s free frinks amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.venue(venueId).amount.should.equal(5);
          done();
        });
      });

    });

    describe('#consume()', function () {

      beforeEach("Calling consume", function (done) {
        var frinks = new FrinksLib();
        frinks.consume(db, venueId, function (err, res) {
          done();
        });
      });

      it('should increase global consumed amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.consumed.should.equal(1);
          done();
        })
      });

      it('should increase venue\'s consumed amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.venue(venueId).consumed.should.equal(1);
          done();
        });
      });
    });


    describe('#revoke()', function () {

      beforeEach("Calling revoke", function (done) {
        var frinks = new FrinksLib();
        frinks.revoke(db, venueId, function (err, res) {
          done();
        });
      });

      it('should increase venue\'s free frinks amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.venue(venueId).amount.should.equal(5);
          done();
        })
      });

      it('should decrease venue\'s reserved amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.venue(venueId).reserved.should.equal(0);
          done();
        });
      });

      it('should decrease venue\'s consumed amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.venue(venueId).consumed.should.equal(-1);
          done();
        });
      });

      it('should decrease global consumed amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.consumed.should.equal(-1);
          done();
        });
      });

      it('should decrease global reserved amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.reserved.should.equal(0);
          done();
        });
      });
    });
  });
});
