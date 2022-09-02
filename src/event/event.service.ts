import * as cheerio from 'cheerio';
import * as moment from 'moment';
import { EventOutputDto } from './dto/event.output.dto';
import { AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';
import { EVENT_STATUS } from './enum/event-status.enum';
import { EVENT_CERTIFICATE } from './enum/event-certificate.enum';
import { EventDistanceDto } from './dto/event-distance.dto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import * as mongoose from 'mongoose';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Event, EventDocument } from './event.model';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @InjectConnection() private readonly connection: mongoose.Connection,
    private readonly httpService: HttpService,
  ) {}

  getEventsBodyFromOrg(): Promise<AxiosResponse> {
    return this.httpService.axiosRef.get(
      'http://www.taipeimarathon.org.tw/contest.aspx',
    );
  }

  crawlerEvents(body: string): EventOutputDto[] {
    const result: EventOutputDto[] = [];
    const $ = cheerio.load(body);
    const tr = $('table.gridview tr');

    let lastRecordMonthIndex;
    let year = moment().format('YYYY');

    for (let i = 1; i < tr.length; i++) {
      const td = tr.eq(i).find('td');

      const month = this.getMonth(td);
      if (month) {
        const monthIndex = this.getMonthIndex(month);
        year = this.getYear(year, monthIndex, lastRecordMonthIndex);
        lastRecordMonthIndex = monthIndex;
      }

      result.push(this.transformEvent(td, year));
    }

    return result;
  }

  async getEvents(): Promise<EventOutputDto[]> {
    return await this.eventModel.find().select(['-_id', '-__v']).exec();
  }

  @Cron('* 3,15 * * *', {
    name: 'update events',
    timeZone: 'Asia/Taipei',
  })
  async updateEvents(): Promise<EventOutputDto[]> {
    this.logger.log('Start update events');
    const transactionSession = await this.connection.startSession();
    transactionSession.startTransaction();
    const fetchResult = await this.getEventsBodyFromOrg();
    if (fetchResult.status === HttpStatus.OK) {
      try {
        this.eventModel.deleteMany({}).exec();
        const eventOutputDto = this.crawlerEvents(fetchResult.data);
        eventOutputDto.map((event) => {
          new this.eventModel(event).save();
        });
        this.logger.log('Update events end');
        return eventOutputDto;
      } catch (error) {
        throw this.logger.error('Error when update events', error);
      } finally {
        transactionSession.endSession();
      }
    }
    throw this.logger.error('Error when update events. API Request Error');
  }

  private transformEvent(td: cheerio.Cheerio, year: string): EventOutputDto {
    const title = this.getTitle(td);
    const [date, time] = this.getDateTime(td);
    const entry = this.getEntry(td);
    const [entryStartDate, endtryEndDate] = this.getEntryStartAndEnd(
      year,
      entry,
    );
    const event = {
      eventName: this.getEventName(title),
      eventInfo: this.getEventInfo(title),
      eventLink: this.getLink(td),
      eventStatus: this.getEventStatus(td),
      eventCertificate: this.getEventCertificate(td),
      eventDate: this.getDate(year, date),
      eventTime: this.getEventTime(time),
      location: this.getLocation(td),
      distances: this.getDistances(td),
      agent: this.getAgent(td),
      entryIsEnd: this.checkEntryIsEnd(entry),
      entryStartDate: entryStartDate,
      entryEndDate: endtryEndDate,
    };

    return event;
  }

  private getTitle(td: cheerio.Cheerio): string {
    return td.eq(1).find('a').text()
      ? td.eq(1).find('a').text().trim()
      : td.eq(1).text().trim();
  }

  private getLink(td: cheerio.Cheerio): string | null {
    return td.eq(1).find('a').text() ? td.eq(1).find('a').attr('href') : null;
  }

  private getDateTime(td: cheerio.Cheerio): Array<string> {
    const [date, , time] = td.eq(3).text().trim().split(' ');
    return [date, time];
  }

  private getEventTime(time: string | null): string | null {
    if (time) {
      return time;
    }

    return null;
  }

  private getEventStatus(td: cheerio.Cheerio): EVENT_STATUS {
    return td.eq(1).css('text-decoration') === 'line-through'
      ? EVENT_STATUS.CANCELED_OR_POSTPONE
      : EVENT_STATUS.NORMAL;
  }

  private getEventCertificate(td: cheerio.Cheerio): EVENT_CERTIFICATE | null {
    const certificate = td.eq(2).find('img').attr('src');
    let eventCertificate: EVENT_CERTIFICATE | null;
    switch (certificate) {
      case '/images/iaaf.gif':
        eventCertificate = EVENT_CERTIFICATE.IAAF;
        break;
      case '/images/aims_logo.gif':
        eventCertificate = EVENT_CERTIFICATE.AIMS;
        break;
      case '/images/course_ok.png':
        eventCertificate = EVENT_CERTIFICATE.COURSE_CACULATED;
        break;
      default:
        eventCertificate = null;
    }
    return eventCertificate;
  }

  private getYear(
    year: string,
    monthIndex: number,
    lastRecordMonthIndex: number | undefined,
  ): string {
    if (lastRecordMonthIndex > monthIndex) {
      return moment(year).add(1, 'years').format('YYYY');
    }
    return year;
  }

  private getMonth(td: cheerio.Cheerio): string | null {
    return td.eq(0).find('span').text() ?? null;
  }
  private getLocation(td: cheerio.Cheerio): string | null {
    return td.eq(4).text() ?? null;
  }

  private getDistances(td: cheerio.Cheerio): EventDistanceDto[] {
    const distancesElement = td.eq(5).find('button');
    const distances: EventDistanceDto[] = [];
    if (distancesElement.length > 0) {
      for (let i = 0; i <= distancesElement.length - 1; i++) {
        const data = distancesElement.eq(i).html();
        let distance = null;
        let complexDistance = null;
        if (
          !data.includes('+') &&
          data.includes('K') &&
          !isNaN(parseFloat(data.replace('K', '')))
        ) {
          distance = parseFloat(data.replace('K', ''));
        } else {
          complexDistance = data;
        }
        const distanceInfo = distancesElement.eq(i).attr('title').split('：');
        const eventPrice = parseInt(distanceInfo[1].split('<br/>')[0].trim());
        const eventLimit = parseInt(distanceInfo[2]);
        distances.push({
          distance,
          complexDistance,
          eventPrice: isNaN(eventPrice) ? null : eventPrice,
          eventLimit: isNaN(eventLimit) ? null : eventLimit,
        });
      }
    }

    return distances;
  }

  private getAgent(td: cheerio.Cheerio): string {
    return td.eq(6).text();
  }

  private getEntry(td: cheerio.Cheerio): string {
    return td.eq(7).text().trim().replace(/\s/g, '');
  }

  private getEntryStartAndEnd(
    year: string,
    entry: string | null,
  ): Array<string | null> {
    if (entry === '已截止') {
      return [null, null];
    }

    if (entry !== null) {
      let entryStart = null;
      let entryEnd = null;
      const [start, end] = entry.split('~');
      if (start) {
        entryStart = this.formatChineseDateToDate(year, start);
      }
      if (end) {
        entryEnd = this.formatChineseDateToDate(year, end);
      }
      if (entryStart > entryEnd) {
        entryEnd = moment(entryEnd).add(1, 'years').format('YYYY-MM-DD');
      }
      return [entryStart, entryEnd];
    }
    return null;
  }

  private formatChineseDateToDate(year: string, dateFormat: string): string {
    const date = moment(
      dateFormat.match(/^(0?[1-9]|1[0-2])[月](0?[1-9]|[12]\d|30|31)[日]/gi)[0],
      'M月DD日',
      'en',
      true,
    ).format('MM-DD');
    return year + '-' + date;
  }

  private checkEntryIsEnd(entry: string | null): boolean {
    if (entry === '已截止') {
      return true;
    }
    return false;
  }

  private getEventName(title: string): string {
    const { first, last } = this.getBrackets(title);
    if (first === null && last === null) {
      return title;
    }
    return title.substring(0, title.indexOf(first));
  }

  private getEventInfo(title: string): string | null {
    const { first, last } = this.getBrackets(title);

    if (first === null && last === null) {
      return null;
    }

    return title.substring(title.indexOf(first) + 1, title.indexOf(last));
  }

  private getDate(year: string, date: string): string {
    return moment(new Date(`${year}/${date}`)).format('YYYY-MM-DD');
  }

  private getBrackets(title: string): any {
    const brackets = {
      first: null,
      last: null,
    };
    if (title.includes('（')) {
      brackets.first = '（';
    } else if (title.includes('(')) {
      brackets.first = '(';
    }

    if (title.includes('）')) {
      brackets.last = '）';
    } else if (title.includes(')')) {
      brackets.last = ')';
    }

    return brackets;
  }

  private getMonthIndex(month: string): number {
    const monthArr = [
      '1月',
      '2月',
      '3月',
      '4月',
      '5月',
      '6月',
      '7月',
      '8月',
      '9月',
      '10月',
      '11月',
      '12月',
    ];
    let index;
    monthArr.forEach((m, i) => {
      if (m === month) {
        index = i;
      }
    });
    return index;
  }
}
