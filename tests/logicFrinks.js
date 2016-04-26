/**
 * Created by spiritinlife on 10/2/15.
 */
var should = require('should'),
  moment = require('moment'),
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
      frinks.should.have.property('info');
    });

    it('should have as default collection : timetablefrinks', function () {
      var frinks = new FrinksLib();
      frinks.options.should.have.property('collection', 'timetablefrinks');
    });

  });

  describe('#date shifting', function () {

    describe('#shiftedDate', function () {

      it('should be shiftedDate if effectiveDate is after  midnight', function () {
        var now = moment().hours(3).utc();
        var context = {
          effectiveDate: now
        };
        var frinks = new FrinksLib(context);
        frinks.shiftedDate.should.equal(true);
      });


      describe('if it is a shiftedDate', function () {
        var now = moment().hours(3).utc();
        var context = {
          effectiveDate: now
        };
        var frinks = new FrinksLib(context);
        var yesterday = now.subtract(1, 'day').hours(frinks.options.validFrom).minutes(0).seconds(0).utc();

        it('effectiveDate should be yesterday at the start at the start of the gaming cycle', function () {
          var isYesterday = frinks.effectiveDate.day() === yesterday.day();
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

        it('info.id should be yesterday\'s YYYYMMDD', function () {
          // this is actually the effectiveDate
          (frinks.info.id === yesterday.format('YYYYMMDD')).should.equal(true);
        })

      });

      it('should not be shiftedDate if effectiveDate is before  midnight', function () {
        var now = moment().hours(10).utc();
        var context = {
          effectiveDate: now
        };
        var frinks = new FrinksLib(context);
        frinks.shiftedDate.should.equal(false);
      });

      describe('if it is not a shiftedDate', function () {
        var now = moment().utc();
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
          // this is actually the effectiveDate
          (frinks.effectiveFrom.diff(now.hours(frinks.options.validFrom).minutes(0).seconds(0), 'milliseconds')).should.equal(0);
        })

        it('effectiveUntil should equal to today\'s gaming cycle + 24 hours', function () {
          // this is actually the effectiveDate
          (frinks.effectiveUntil.diff(now.hours(frinks.options.validFrom).minutes(0).seconds(0), 'hours')).should.equal(24);
        })

        it('info.id should be today\'s YYYYMMDD', function () {
          // this is actually the effectiveDate
          (frinks.info.id === now.format('YYYYMMDD')).should.equal(true);
        })
      });
    });
  });

  describe('#TESTS on info.id which is what is used to retrieve the correct timetablefrinks', function () {

    var tests = [

      {arg: moment("2015-10-02 3:00 +0000", "YYYY-MM-DD HH:mm Z").utc(), expected: "20151001"},// this is a shifted date since we are after midnight so return 20151001
      {arg: moment("2015-10-02 3:59 +0000", "YYYY-MM-DD HH:mm Z").utc(), expected: "20151001"},
      {arg: moment("2015-10-02 4:00 +0000", "YYYY-MM-DD HH:mm Z").utc(), expected: "20151002"},
      {arg: moment("2015-11-02 4:01 +0000", "YYYY-MM-DD HH:mm Z").utc(), expected: "20151102"},
      {arg: moment("2016-11-02 4:01 +0000", "YYYY-MM-DD HH:mm Z").utc(), expected: "20161102"},
      {arg: moment("2016-11-02 4:01 +0000", "YYYY-MM-DD HH:mm Z").utc(), expected: "20161102"},
      {arg: moment("2016-11-02 4:01 +0000", "YYYY-MM-DD HH:mm Z").utc(), expected: "20161102"},
      {arg: moment("2016-11-02 16:01 +0000", "YYYY-MM-DD HH:mm Z").utc(), expected: "20161102"},
      {arg: moment("2016-11-02 00:01 +0000", "YYYY-MM-DD HH:mm Z").utc(), expected: "20161101"},
    ];

    tests.forEach(function (test) {
      it('correctly finds ' + test.arg.toDate() + ' to have id of ' + test.expected, function () {
        var context = {
          effectiveDate: test.arg
        };
        var frinks = new FrinksLib(context);
        frinks.info.id.should.equal(test.expected);
      });
    });

  });

  describe('#Test frink logic', function () {
    var today = moment().utc();
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
      "amount": 4
    };
    var timetableFrink = {
      id: todayId,
      venues: venues,
      amount: 4
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
          timetable.venue(venueId).reserved.should.equal(1);
          done();
        });
      });

      it('should increase global amount of reservations by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.info.reserved.should.equal(1);
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
          timetable.info.reserved.should.equal(-1);
          done();
        })
      });

      it('should decrease venue\'s reserved amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.venue(venueId).reserved.should.equal(-1);
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
          timetable.info.consumed.should.equal(1);
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


    describe('#release()', function () {

      beforeEach("Calling release", function (done) {
        var frinks = new FrinksLib();
        frinks.release(db, venueId, function (err, res) {
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
          timetable.venue(venueId).reserved.should.equal(-1);
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
          timetable.info.consumed.should.equal(-1);
          done();
        });
      });

      it('should decrease global reserved amount by one', function (done) {
        var frinks = new FrinksLib();
        frinks.sync(db, function (err, timetable) {
          timetable.info.reserved.should.equal(-1);
          done();
        });
      });
    });
  });
});