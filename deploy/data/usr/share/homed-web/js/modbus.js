class Modbus extends DeviceService
{
    deviceType =
    {
        homedRelayController:  'HOMEd Relay Controller',
        homedSwitchController: 'HOMEd Switch Controller',
        wbMap3e:               'Wiren Board WB-MAP3E',
        wbMap12h:              'Wiren Board WB-MAP12H'
    };

    constructor(controller)
    {
        super(controller, 'modbus');
    }

    parseMessage(list, message)
    {
        if (list[0] == 'status')
        {
            var check = false;

            this.names = message.names;
            this.version = message.version;

            message.devices.forEach(device =>
            {
                device.id = device.portId + '.' + device.slaveId;

                if (!device.name)
                    device.name = device.id;

                if (!this.devices[device.id])
                {
                    var item = this.names ? device.name : device.id;

                    this.devices[device.id] = new Device('modbus', device.id);
                    this.controller.socket.subscribe('expose/modbus/' + item);
                    this.controller.socket.subscribe('device/modbus/' + item);

                    check = true;
                }

                // TODO: remove it
                device.active = true;
                device.discovery = true;
                device.cloud = true;
                //

                this.devices[device.id].info = device;
            });

            Object.keys(this.devices).forEach(id =>
            {
                if (message.devices.filter(device => (device.portId + '.' + device.slaveId) == id).length)
                    return;

                delete this.devices[id];
                check = true;
            });

            if (this.controller.service == 'modbus')
            {
                if (check)
                    this.showDeviceList();

                document.querySelector('#serviceVersion').innerHTML = 'Modbus ' + this.version;
            }

            return;
        }

        super.parseMessage(list, message);
    }

    parseValue(key, value)
    {
        return key != 'type' ? super.parseValue(key, value) : this.deviceType[value] ?? '<span class="shade">' + value + '</span>';
    }

    showMenu()
    {
        var menu = document.querySelector('.menu');

        menu.innerHTML  = '<span id="list"><i class="icon-list"></i> Devices</span>';
        menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.showDeviceList(); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showDeviceEdit(); }.bind(this));

        document.querySelector('#serviceVersion').innerHTML = this.version ? 'Modbus ' + this.version : 'unknown';
    }

    showDeviceList()
    {
        this.controller.setService('modbus');
        this.controller.setPage('modbus');

        if (!Object.keys(this.devices).length)
        {
            this.content.innerHTML = '<div class="emptyList">modbus devices list is empty</div>';
            return;
        }

        fetch('html/modbus/deviceList.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var table;

            this.content.innerHTML = html;
            table = this.content.querySelector('.deviceList table');

            Object.keys(this.devices).forEach(id =>
            {
                var device = this.devices[id];
                var row = table.querySelector('tbody').insertRow();

                row.addEventListener('click', function() { this.showDeviceInfo(device); }.bind(this));
                row.dataset.device = 'modbus/' + device.id;

                for (var i = 0; i < 7; i++)
                {
                    var cell = row.insertCell();

                    switch (i)
                    {
                        case 0:

                            cell.innerHTML = device.info.name;

                            if (device.info.note)
                            {
                                cell.innerHTML += '<span class="note">' + device.info.note + '</span>';
                                row.classList.add('tooltip');
                            }

                            break;

                        case 1: cell.innerHTML = this.deviceType[device.info.type] ?? '<span class="shade">' + device.info.type + '</span>'; break;
                        case 2: cell.innerHTML = '<span class="value">' + device.info.portId + '</span>'; cell.classList.add('center'); break;
                        case 3: cell.innerHTML = '<span class="value">' + device.info.slaveId + '</span>'; cell.classList.add('center'); break;
                        case 4: cell.innerHTML = this.parseValue('discovery', device.info.discovery); cell.classList.add('center'); break;
                        case 5: cell.innerHTML = this.parseValue('cloud', device.info.cloud); cell.classList.add('center'); break;
                        case 6: cell.innerHTML = empty; cell.classList.add('availability', 'center'); break;
                    }

                }
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index, false); localStorage.setItem('customSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('customSort') ?? 0, false);
        });
    }

    showDeviceEdit(device = undefined)
    {
        var add = false;

        if (!device)
        {
            var random = Math.random().toString(36).substring(2, 7);
            device = {info: {name: 'Device ' + random, id: 'device_' + random, portId: 1, slaveId: 1, baudRate: 9600, pollInterval: 1000, active: true}};
            add = true;
        }

        fetch('html/modbus/deviceEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('input[name="name"]').value = device.info.name;
            modal.querySelector('textarea[name="note"]').value = device.info.note ?? '';

            Object.keys(this.deviceType).forEach(key =>
            {
                var option = document.createElement('option');

                option.innerHTML = this.deviceType[key];
                option.value = key;

                modal.querySelector('select[name="type"]').append(option);

                if (device.info.type != key)
                    return;

                modal.querySelector('select[name="type"]').value = key;
            });

            modal.querySelector('input[name="portId"]').value = device.info.portId;
            modal.querySelector('input[name="slaveId"]').value = device.info.slaveId;
            modal.querySelector('input[name="baudRate"]').value = device.info.baudRate;
            modal.querySelector('input[name="pollInterval"]').value = device.info.pollInterval;
            modal.querySelector('input[name="discovery"]').checked = device.info.discovery;
            modal.querySelector('input[name="cloud"]').checked = device.info.cloud;
            modal.querySelector('input[name="active"]').checked = device.info.active;
            modal.querySelector('.save').addEventListener('click', function() { this.controller.socket.publish('command/modbus', {action: 'updateDevice', device: add ? null : this.names ? device.info.name : device.id, data: formData(modal.querySelector('form'))}); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            modal.removeEventListener('keypress', handleSave);
            modal.addEventListener('keypress', handleSave);
            showModal(true);

            modal.querySelector('input[name="name"]').focus();
        });
    }
}
