import { useEffect, useState } from 'react';

import { type DeviceType } from '~/types';

const useDeviceType = (): DeviceType => {
    const [deviceType, setDeviceType] = useState<DeviceType>('desktop');

    useEffect(() => {
        const checkDeviceType = () => {
            const screenWidth = window.innerWidth;

            if (screenWidth < 768) {
                setDeviceType('mobile');
            } else if (screenWidth < 1024) {
                setDeviceType('tablet');
            } else if (screenWidth < 1440) {
                setDeviceType('desktop');
            } else {
                setDeviceType('monitor');
            }
        };

        checkDeviceType();

        window.addEventListener('resize', checkDeviceType);
        return () => {
            window.removeEventListener('resize', checkDeviceType);
        };
    }, []);

    return deviceType;
};

export default useDeviceType;