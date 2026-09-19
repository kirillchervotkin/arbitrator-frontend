import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorText } from '../src/pages/schedule/model.ts';
test('показывает сообщения полей из Problem Details и убирает повторы', () => {
  const reason = 'Команда с таким названием уже существует в этом городе.';
  const error = { isAxiosError: true, response: { status: 409, data: { invalid_params: [
    {name: 'name', errors: [{reason}]}, {name: 'cityId', errors: [{reason}]},
  ] } } };
  assert.equal(errorText(error), reason);
});
test('связанные записи не маскируются под сетевую ошибку', () => {
  const result = errorText({isAxiosError: true, response: {status: 409, data: {type: 'http://localhost/errors/resource-in-use'}}});
  assert.match(result, /используется/);
});
